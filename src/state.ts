/**
 * What state is the language in, and what should the extension show and offer?
 *
 * This module is deliberately free of any `vscode` import: the states, the
 * status bar text and the actions offered are pure functions of what two
 * probes answered. That is what makes the user journeys testable
 * (`test/journeys.js`) without launching an editor — and the journeys are
 * where the bugs were: the status bar said "not installed" for ever, because
 * nothing ever asked a second time.
 */

/** The result of `python -m ldpy.debug --probe`. */
export interface LdpyProbe {
    package: string;
    version: string | null;
    python: string;
    rules: { justMyCode: DebugRule[]; all: DebugRule[] };
}

export interface DebugRule { path: string; include: boolean; }

/** What the two probes found out about an interpreter. */
export interface Findings {
    /** The interpreter path we asked. */
    python: string;
    /** `python -c "import ldpy"` succeeded. */
    importable: boolean;
    /** `python -m ldpy.debug --probe` answered, and the answer parsed. */
    probe?: LdpyProbe;
    /** The interpreter itself could not be run at all. */
    pythonMissing?: boolean;
}

export type State =
    /** Everything is there; the language server can run. */
    | 'ready'
    /** The package is there but predates this extension (no `--probe`). */
    | 'outdated'
    /** The interpreter runs, the package is not installed. */
    | 'missing'
    /** The interpreter itself cannot be run. */
    | 'noPython';

export function classify(f: Findings): State {
    if (f.pythonMissing) { return 'noPython'; }
    if (f.probe) { return 'ready'; }
    return f.importable ? 'outdated' : 'missing';
}

/** True while the extension cannot serve the language. */
export function isBroken(state: State): boolean {
    return state !== 'ready';
}

export interface StatusView {
    text: string;
    tooltip: string;
    warn: boolean;
    /** What clicking the status bar item does, in THIS state. */
    command: string;
}

/**
 * The status bar answers the question people actually have. When everything
 * works, that question is "which interpreter?"; when nothing works, it is
 * "what do I do about it?" — so the click does not lead to the same place.
 */
export function statusView(state: State, f: Findings): StatusView {
    const where = `interpreter: ${f.python}`;
    switch (state) {
        case 'ready': {
            const v = f.probe?.version ?? '?';
            return {
                text: v,
                tooltip: `linked-data-python ${v}\n${f.probe?.package}\n${where}`,
                warn: false,
                command: 'ldpy.selectInterpreter',
            };
        }
        case 'outdated':
            return {
                text: 'update needed',
                tooltip: 'The installed linked-data-python predates this '
                    + `extension.\n${where}\nClick for what to do about it.`,
                warn: true,
                command: 'ldpy.setup',
            };
        case 'missing':
            return {
                text: 'not installed',
                tooltip: `linked-data-python is not installed.\n${where}\n`
                    + 'Click to install it, or to pick another interpreter.',
                warn: true,
                command: 'ldpy.setup',
            };
        case 'noPython':
            return {
                text: 'no interpreter',
                tooltip: `Could not run "${f.python}".\n`
                    + 'Click to choose another interpreter.',
                warn: true,
                command: 'ldpy.setup',
            };
    }
}

/** The sentence shown once, when the extension gives up on starting. */
export function explain(state: State, f: Findings): string {
    const pip = 'pip install -U "linked-data-python[lsp,debug,format]"';
    switch (state) {
        case 'ready':
            return '';
        case 'outdated':
            return `ldpy: the package installed for "${f.python}" predates `
                + 'this extension (no `ldpy.debug --probe`). Update it: '
                + pip + '.';
        case 'missing':
            return `ldpy: package not found for "${f.python}". Install `
                + `linked-data-python in that environment (${pip}), or set `
                + 'ldpy.pythonPath.';
        case 'noPython':
            return `ldpy: could not run "${f.python}". Choose a Python `
                + 'interpreter, or set ldpy.pythonPath.';
    }
}

/** One entry of the menu the status bar opens when something is wrong. */
export interface SetupChoice {
    label: string;
    detail?: string;
    command: string;
}

/**
 * What clicking "ldpy: not installed" offers.
 *
 * A single click that installs straight away would decide for the user which
 * interpreter receives the package — and getting that wrong is the whole
 * problem this status bar exists to signal. So the click opens a choice:
 * install HERE, or go and pick somewhere else first.
 */
export function setupMenu(state: State, f: Findings): SetupChoice[] {
    const into = `into ${f.python}`;
    const pick: SetupChoice = {
        label: '$(list-selection) Select a Python interpreter',
        detail: 'Choose the environment ldpy should use',
        command: 'ldpy.selectInterpreter',
    };
    const again: SetupChoice = {
        label: '$(refresh) Check again',
        detail: 'Probe the interpreter once more',
        command: 'ldpy.refresh',
    };
    const log: SetupChoice = {
        label: '$(output) Show the log',
        command: 'ldpy.showServerOutput',
    };
    switch (state) {
        case 'missing':
            return [{
                label: '$(cloud-download) Install linked-data-python',
                detail: into, command: 'ldpy.installPackage',
            }, pick, again, log];
        case 'outdated':
            return [{
                label: '$(cloud-download) Update linked-data-python',
                detail: into, command: 'ldpy.installPackage',
            }, pick, again, log];
        case 'noPython':
            // Installing into an interpreter that will not run is nonsense.
            return [pick, again, log];
        case 'ready':
            return [pick, {
                label: '$(debug-restart) Restart the language server',
                command: 'ldpy.restartServer',
            }, {
                label: '$(cloud-download) Update linked-data-python',
                detail: into, command: 'ldpy.installPackage',
            }, log];
    }
}

/**
 * The buttons on that notification. `Install`/`Update` come first because
 * they are what the user wants; nothing here ever runs on its own — the
 * interpreter belongs to the user, and installing into it is their call.
 */
export function actions(state: State): string[] {
    switch (state) {
        case 'ready': return [];
        case 'outdated': return ['Update', 'Select interpreter', 'Check again'];
        case 'missing': return ['Install', 'Select interpreter', 'Check again'];
        case 'noPython': return ['Select interpreter', 'Check again'];
    }
}

/** The command each button runs. */
export function commandFor(action: string): string | undefined {
    return {
        'Install': 'ldpy.installPackage',
        'Update': 'ldpy.installPackage',
        'Select interpreter': 'ldpy.selectInterpreter',
        'Check again': 'ldpy.refresh',
    }[action];
}

/**
 * Should we probe again on our own?
 *
 * Only while something is broken. The journey that made this necessary: the
 * user reads "not installed", switches to a terminal, runs pip, comes back —
 * and the extension has no idea anything changed. Re-probing when the window
 * regains focus costs one subprocess and closes that loop; doing it while
 * everything already works would cost one for nothing.
 */
export function shouldReprobeOnFocus(state: State): boolean {
    return isBroken(state);
}
