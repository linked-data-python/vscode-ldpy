'use strict';
/**
 * The user journeys, as a test.
 *
 * The bug that prompted this: the status bar said "not installed" for ever.
 * Installing the package by hand changed nothing, choosing another
 * interpreter changed nothing — because the extension probed once, at
 * activation, and never again.
 *
 * A journey is a sequence of what the two probes answer over time. The
 * decision logic is pure (src/state.ts), so a journey is a plain list, and
 * every step asserts what the user SEES (status bar text, whether it warns,
 * what clicking does) and what the extension DOES next (probe again on its
 * own, or not).
 *
 * What this cannot test is the wiring to VS Code — that the focus event is
 * subscribed, that the command ids exist. `test/contributes.js` covers the
 * command ids; the subscriptions are asserted here by grepping the source,
 * which is crude but catches the regression that matters: a listener quietly
 * deleted.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'out', 'state.js');
if (!fs.existsSync(OUT)) {
    cp.execSync('npx tsc -p ./', { cwd: ROOT, stdio: 'inherit' });
}
const S = require(OUT);

const PY = '/home/user/.venv/bin/python';

/** What the two probes answer, for a given situation. */
const FINDINGS = {
    ready: { python: PY, importable: true, probe: {
        package: '/x/ldpy', version: '0.2.1', python: PY,
        rules: { justMyCode: [], all: [] } } },
    outdated: { python: PY, importable: true },
    missing: { python: PY, importable: false },
    noPython: { python: PY, importable: false, pythonMissing: true },
};

let failures = 0;
const ok = (m) => console.log(`ok     ${m}`);
const fail = (m) => { failures++; console.error(`ÉCHEC  ${m}`); };

function check(name, fn) {
    try { fn(); ok(name); } catch (e) { fail(`${name}\n       ${e.message}`); }
}

/** Replays a journey and returns what the user saw at each step. */
function walk(steps) {
    return steps.map((situation) => {
        const f = FINDINGS[situation];
        const state = S.classify(f);
        const view = S.statusView(state, f);
        return {
            state,
            text: view.text,
            warn: view.warn,
            click: view.command,
            reprobes: S.shouldReprobeOnFocus(state),
            actions: S.actions(state),
        };
    });
}

// ---------------------------------------------------- 1. the reported bug

check('journey: nothing installed, then pip install by hand', () => {
    const [before, after] = walk(['missing', 'ready']);
    assert.strictEqual(before.text, 'not installed');
    assert.ok(before.warn, 'the status bar must warn');
    // The whole point: while broken, the extension probes again on its own.
    assert.ok(before.reprobes,
        'a broken state must be re-probed — this is the reported bug');
    assert.strictEqual(after.text, '0.2.1');
    assert.ok(!after.warn);
    assert.ok(!after.reprobes, 'a working state must not probe on every focus');
});

check('journey: clicking the status bar offers a choice, not a decision', () => {
    const [broken] = walk(['missing']);
    assert.strictEqual(broken.click, 'ldpy.setup',
        'a single click must not decide WHICH interpreter gets the package');
    const menu = S.setupMenu('missing', FINDINGS.missing);
    assert.match(menu[0].label, /Install/,
        'installing here is the first thing offered');
    assert.ok(menu[0].detail.includes(PY),
        'and it says where it would install');
    assert.ok(menu.some((c) => c.command === 'ldpy.selectInterpreter'),
        'picking another interpreter must be one click away');
    const [fine] = walk(['ready']);
    assert.strictEqual(fine.click, 'ldpy.selectInterpreter',
        'when all is well, the question is which interpreter');
});

check('journey: select an interpreter, then install into THAT one', () => {
    // The user clicks the status bar, picks "Select a Python interpreter",
    // lands on another broken environment, and is offered the install again
    // — one gesture, not two disconnected ones.
    const menu = S.setupMenu('missing', FINDINGS.missing);
    const pick = menu.find((c) => c.command === 'ldpy.selectInterpreter');
    assert.ok(pick, 'the menu must offer picking an interpreter');
    const after = S.setupMenu(S.classify(FINDINGS.missing), FINDINGS.missing);
    assert.match(after[0].label, /Install/,
        're-opening after a pick must still offer the install');
});

check('the setup menu never offers what makes no sense', () => {
    const noPy = S.setupMenu('noPython', FINDINGS.noPython);
    assert.ok(!noPy.some((c) => c.command === 'ldpy.installPackage'),
        'installing into an interpreter that will not run is nonsense');
    const outdated = S.setupMenu('outdated', FINDINGS.outdated);
    assert.match(outdated[0].label, /Update/, 'an old package is updated');
    for (const state of ['ready', 'missing', 'outdated', 'noPython']) {
        for (const c of S.setupMenu(state, FINDINGS[state])) {
            assert.ok(c.label && c.command, `${state}: incomplete entry`);
        }
    }
});

// -------------------------------------------- 2. the other ways in and out

check('journey: wrong interpreter, then the user selects another', () => {
    const [before, after] = walk(['missing', 'ready']);
    assert.ok(before.actions.includes('Select interpreter'));
    assert.strictEqual(after.state, 'ready');
});

check('journey: an old package is not a missing one', () => {
    const [old] = walk(['outdated']);
    assert.strictEqual(old.text, 'update needed');
    assert.ok(S.explain('outdated', FINDINGS.outdated).includes('predates'));
    assert.ok(old.actions.includes('Update'));
    assert.ok(!old.actions.includes('Install'),
        'offering "Install" for an outdated package is the wrong verb');
});

check('only newer published versions offer an update', () => {
    assert.ok(S.isPublishedVersionNewer('0.5.1', '0.5.2'));
    assert.ok(S.isPublishedVersionNewer('0.5.1rc1', '0.5.1'));
    assert.ok(!S.isPublishedVersionNewer('0.5.1', '0.5.1'));
    assert.ok(!S.isPublishedVersionNewer('0.5.2', '0.5.1'));
    assert.ok(!S.isPublishedVersionNewer('0.5.1', 'not-a-version'));
});

check('journey: no interpreter at all', () => {
    const [none] = walk(['noPython']);
    assert.strictEqual(none.text, 'no interpreter');
    assert.strictEqual(none.click, 'ldpy.setup');
    assert.ok(!none.actions.includes('Install'),
        'installing into an interpreter that will not run is nonsense');
});

check('journey: it breaks again (env deleted) after having worked', () => {
    const [fine, broken] = walk(['ready', 'missing']);
    assert.ok(!fine.reprobes && broken.reprobes);
    assert.ok(broken.warn);
});

// ------------------------------------------------------ 3. the invariants

check('every broken state warns, offers actions and re-probes', () => {
    for (const situation of ['missing', 'outdated', 'noPython']) {
        const [v] = walk([situation]);
        assert.ok(v.warn, `${situation} must warn`);
        assert.ok(v.reprobes, `${situation} must be re-probed`);
        assert.ok(v.actions.length, `${situation} must offer a way out`);
        assert.ok(S.explain(v.state, FINDINGS[situation]).length > 20,
            `${situation} must be explained`);
    }
});

check('every action, menu entry and click maps to a real command', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json')));
    const known = new Set(pkg.contributes.commands.map((c) => c.command));
    for (const situation of Object.keys(FINDINGS)) {
        const state = S.classify(FINDINGS[situation]);
        for (const a of S.actions(state)) {
            const cmd = S.commandFor(a);
            assert.ok(cmd, `no command for the action "${a}"`);
            assert.ok(known.has(cmd), `${cmd} is not contributed`);
        }
        for (const c of S.setupMenu(state, FINDINGS[situation])) {
            assert.ok(known.has(c.command),
                `${situation}: ${c.command} is not contributed`);
        }
        const click = S.statusView(state, FINDINGS[situation]).command;
        assert.ok(known.has(click), `${situation}: ${click} is not contributed`);
    }
});

check('the tooltip always says which interpreter was asked', () => {
    for (const situation of Object.keys(FINDINGS)) {
        const f = FINDINGS[situation];
        assert.ok(S.statusView(S.classify(f), f).tooltip.includes(PY),
            `${situation}: the interpreter is the first thing one needs`);
    }
});

// ------------------------------- 4. the wiring these journeys depend upon

const SRC = fs.readFileSync(path.join(ROOT, 'src', 'extension.ts'), 'utf8');

check('the extension listens for what makes a broken state recoverable', () => {
    assert.ok(/onDidChangeWindowState/.test(SRC),
        'without it, a pip install in a terminal is never noticed');
    assert.ok(/shouldReprobeOnFocus/.test(SRC),
        'the focus listener must consult the state, not probe blindly');
    assert.ok(/onDidChangeActiveEnvironmentPath/.test(SRC),
        'choosing an interpreter is not a change to OUR settings');
});

check('a missing package is a state, never a thrown exception', () => {
    const start = SRC.slice(SRC.indexOf('async function startClient'),
        SRC.indexOf('async function refresh'));
    assert.ok(!/throw /.test(start),
        'throwing here left the client uncreated and nothing ever retried');
});

check('the package is never installed without asking', () => {
    const install = SRC.slice(SRC.indexOf('async function installPackage'));
    assert.ok(/showInformationMessage[\s\S]{0,200}modal: true/.test(install),
        'the interpreter belongs to the user: ask, modally, first');
});

check('a newer PyPI release is checked without blocking startup', () => {
    assert.ok(SRC.includes('https://pypi.org/pypi/linked-data-python/json'));
    assert.ok(/request\.setTimeout\(10000/.test(SRC),
        'the update check must not wait indefinitely for the network');
    assert.ok(/isPublishedVersionNewer\(installed, published\)/.test(SRC));
    assert.ok(/choice === 'Update'.*installPackage/s.test(SRC),
        'the published update must reuse the explicit install confirmation');
    assert.ok(/void offerPackageUpdate\(findings\)/.test(SRC),
        'the version check must not delay language-server startup');
});

check('the shadow path is resolved before becoming a URI', () => {
    assert.ok(/isAbsolute\(info\.shadow\)/.test(SRC),
        'a relative path through Uri.file lands at the filesystem root');
});

console.log(failures ? `\n${failures} échec(s).` : '\nTout est vert.');
process.exit(failures ? 1 : 0);
