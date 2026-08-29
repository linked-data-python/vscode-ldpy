/**
 * Extension VS Code Linked-Data Python (fiche vscode/102).
 *
 * - Client LSP vers `python -m ldpy.lsp` (diagnostics, complétion, hover,
 *   définition, références, semantic tokens des îlots).
 * - Débogage NATIF (F5, type `ldpy`) : la configuration est traduite en une
 *   session debugpy sur `python -m ldpy.debug --run fichier.ldpy` — le code
 *   est compilé en coordonnées source (fiche ldpy/011), les breakpoints
 *   posés dans le .ldpy se lient donc directement, sans fantôme ni
 *   traduction. Aucun adaptateur DAP à écrire.
 *   Les `rules` de pas (fiche vscode/103, qui masquent le lanceur et, sous
 *   justMyCode, le runtime) viennent de `python -m ldpy.debug --probe` :
 *   elles sont décrites dans le paquet Python, pas ici.
 * - Points d'arrêt : celui posé DANS un îlot multiligne ne peut pas se lier
 *   (l'îlot s'effondre en une instruction) ; on le déplace visiblement sur
 *   la première ligne de l'îlot, via la requête LSP `ldpy/breakpointLines`.
 * - Formatage : fourni par le serveur (`textDocument/formatting`), donc
 *   « Format Document » et `editor.formatOnSave` marchent sans rien de plus.
 * - Commandes, menus et réglages : fiche vscode/105. Aucun raccourci clavier
 *   par défaut — les touches appartiennent à l'utilisateur ; les gestes
 *   fréquents passent par le bouton ▷ du titre de l'éditeur.
 * - Interpréteur : ldpy.pythonPath s'il est réglé, sinon l'interpréteur
 *   actif de l'extension Python, sinon `python3`.
 */
import * as cp from 'child_process';
import * as path from 'path';
import * as vscode from 'vscode';
import {
    LanguageClient, LanguageClientOptions, ServerOptions
} from 'vscode-languageclient/node';

let client: LanguageClient | undefined;
let status: vscode.StatusBarItem | undefined;
let output: vscode.OutputChannel | undefined;
/** Vrai pendant qu'on remplace des points d'arrêt (anti-réentrance). */
let snapping = false;

/**
 * « Quel interpréteur ? » est la première question quand rien ne marche —
 * l'extension la répond en permanence plutôt qu'à la demande. Un clic ouvre
 * le réglage.
 */
function showStatus(text: string, tooltip: string, warn = false) {
    if (!status) { return; }
    status.text = `$(circuit-board) ldpy: ${text}`;
    status.tooltip = tooltip;
    status.backgroundColor = warn
        ? new vscode.ThemeColor('statusBarItem.warningBackground')
        : undefined;
    status.command = 'ldpy.selectInterpreter';
}

function updateStatusVisibility(editor?: vscode.TextEditor) {
    const doc = (editor ?? vscode.window.activeTextEditor)?.document;
    if (doc?.languageId === 'ldpy') { status?.show(); } else { status?.hide(); }
}

function config() {
    const c = vscode.workspace.getConfiguration('ldpy');
    return {
        backend: c.get<string>('backend', 'pylsp'),
        buildDir: c.get<string>('buildDirectory', '.ldpy-build'),
        lineLength: c.get<number>('lineLength', 88),
    };
}

/**
 * Interpréteur Python : réglage explicite > extension Python > `python3`.
 *
 * Le réglage a pour défaut la chaîne VIDE (fiche vscode/105) : « non réglé »
 * devient ainsi une valeur, et non une valeur qu'il faut deviner en
 * interrogeant les portées de configuration.
 */
async function resolvePython(): Promise<string> {
    const c = vscode.workspace.getConfiguration('ldpy');
    const explicit = c.get<string>('pythonPath', '').trim();
    if (explicit) { return explicit; }
    try {
        const ext = vscode.extensions.getExtension('ms-python.python');
        if (ext) {
            if (!ext.isActive) { await ext.activate(); }
            const p = ext.exports?.environments
                ?.getActiveEnvironmentPath()?.path;
            if (p) { return p; }
        }
    } catch { /* on retombe sur le défaut */ }
    return process.platform === 'win32' ? 'python' : 'python3';
}

/** Ce que `python -m ldpy.debug --probe` rapporte sur un interpréteur. */
interface LdpyProbe {
    package: string;
    version: string | null;
    python: string;
    rules: { justMyCode: DebugRule[]; all: DebugRule[] };
}

interface DebugRule { path: string; include: boolean; }

/**
 * Interroge l'interpréteur : le paquet ldpy est-il là, et avec quelles règles
 * de pas ? Un seul processus remplace l'ancien `import ldpy`, et la politique
 * de la fiche vscode/103 reste décrite d'un seul côté (Python), donc testée
 * par la suite pytest plutôt que réécrite ici.
 */
function probeLdpy(python: string): Promise<LdpyProbe | undefined> {
    return new Promise((resolve) => {
        cp.execFile(python, ['-m', 'ldpy.debug', '--probe'],
            { timeout: 20000 }, (err, stdout) => {
                if (err) { resolve(undefined); return; }
                try { resolve(JSON.parse(stdout) as LdpyProbe); }
                catch { resolve(undefined); }
            });
    });
}

/** Le paquet est-il seulement importable ? (pour distinguer les pannes) */
function ldpyImportable(python: string): Promise<boolean> {
    return new Promise((resolve) => {
        cp.execFile(python, ['-c', 'import ldpy'],
            { timeout: 20000 }, (err) => resolve(!err));
    });
}

/**
 * Dit ce qui manque, précisément. « Paquet introuvable » quand le paquet est
 * là mais trop vieux est un message qui fait perdre une demi-heure.
 */
async function explainMissingLdpy(python: string): Promise<string> {
    if (await ldpyImportable(python)) {
        return `ldpy : le paquet installé pour « ${python} » est antérieur à ` +
            "cette extension (pas de `ldpy.debug --probe`). " +
            'Mettre à jour : pip install -U "linked-data-python[lsp,debug,format]".';
    }
    return `ldpy : paquet introuvable pour « ${python} ». ` +
        'Installer linked-data-python dans cet environnement ' +
        '(pip install "linked-data-python[lsp,debug,format]") ' +
        'ou régler ldpy.pythonPath.';
}

async function startClient(context: vscode.ExtensionContext) {
    const { backend, lineLength } = config();
    const python = await resolvePython();
    const probe = await probeLdpy(python);
    if (!probe) {
        showStatus('non installé', await explainMissingLdpy(python), true);
        throw new Error(await explainMissingLdpy(python));
    }
    showStatus(probe.version ?? 'prêt',
        `linked-data-python ${probe.version ?? '?'}\n${probe.package}\n` +
        `interpréteur : ${python}`);
    const serverOptions: ServerOptions = {
        command: python,
        args: ['-m', 'ldpy.lsp', '--backend', backend,
            '--line-length', String(lineLength)],
    };
    const clientOptions: LanguageClientOptions = {
        documentSelector: [{ language: 'ldpy' }],
        outputChannel: output,
    };
    client = new LanguageClient('ldpy', 'Linked-Data Python',
        serverOptions, clientOptions);
    await client.start();
    context.subscriptions.push({ dispose: () => client?.stop() });
}

// ----------------------------------------------------------------- débogage

/** Traduit une configuration `ldpy` en session debugpy « directe »
 * (python -m ldpy.debug --run) et la démarre. */
class LdpyDebugConfigurationProvider
    implements vscode.DebugConfigurationProvider {

    provideDebugConfigurations():
        vscode.ProviderResult<vscode.DebugConfiguration[]> {
        return [{
            type: 'ldpy', request: 'launch',
            name: 'ldpy : fichier courant', program: '${file}',
        }];
    }

    resolveDebugConfiguration(
        _folder: vscode.WorkspaceFolder | undefined,
        cfg: vscode.DebugConfiguration):
        vscode.ProviderResult<vscode.DebugConfiguration> {
        if (!cfg.type && !cfg.request && !cfg.name) {
            // F5 sans launch.json : compléter, la traduction se fait après
            // substitution des variables
            const editor = vscode.window.activeTextEditor;
            if (!editor || editor.document.languageId !== 'ldpy') {
                return undefined;
            }
            return {
                type: 'ldpy', request: 'launch',
                name: 'ldpy : fichier courant',
                program: editor.document.uri.fsPath,
            };
        }
        return cfg;
    }

    async resolveDebugConfigurationWithSubstitutedVariables(
        folder: vscode.WorkspaceFolder | undefined,
        cfg: vscode.DebugConfiguration):
        Promise<vscode.DebugConfiguration | null | undefined> {

        const editor = vscode.window.activeTextEditor;
        const program: string | undefined =
            cfg.program ?? editor?.document.uri.fsPath;
        if (!program) {
            vscode.window.showErrorMessage(
                'ldpy : aucun fichier .ldpy à déboguer.');
            return undefined;
        }
        if (editor?.document.uri.fsPath === program
            && editor.document.isDirty) {
            await editor.document.save();
        }

        const python = cfg.python ?? await resolvePython();
        const probe = await probeLdpy(python);
        if (!probe) {
            vscode.window.showErrorMessage(await explainMissingLdpy(python));
            return null;
        }

        const debugpyType = vscode.extensions.getExtension('ms-python.debugpy')
            ? 'debugpy' : 'python';
        const args = ['--run', program];
        if (Array.isArray(cfg.args) && cfg.args.length) {
            args.push('--', ...cfg.args);
        }
        // Fiche vscode/103 : sans ces règles, un pas au-delà de la dernière
        // ligne atterrit dans ldpy/debug.py et la pile d'appels montre trois
        // trames de plomberie. Une configuration peut les remplacer.
        const justMyCode = cfg.justMyCode ?? true;
        const rules: DebugRule[] = cfg.rules
            ?? (justMyCode ? probe.rules.justMyCode : probe.rules.all);
        // On démarre nous-mêmes la session Python équivalente, puis on
        // annule silencieusement la session « ldpy » (retour null) : c'est
        // le schéma supporté pour déléguer à un autre débogueur.
        await vscode.debug.startDebugging(
            folder ?? vscode.workspace.getWorkspaceFolder(
                vscode.Uri.file(program)), {
            type: debugpyType, request: 'launch',
            name: cfg.name || `ldpy : ${path.basename(program)}`,
            module: 'ldpy.debug', args, python, rules,
            console: cfg.console ?? 'integratedTerminal',
            justMyCode,
            cwd: cfg.cwd ?? path.dirname(program),
            env: cfg.env,
        });
        return null;
    }
}

// --------------------------------------------------------- points d'arrêt

/**
 * Un point d'arrêt posé À L'INTÉRIEUR d'un îlot multiligne ne se déclenchera
 * jamais : l'îlot s'effondre en une seule instruction, qui porte la ligne de
 * DÉBUT (fiche ldpy/011). debugpy répond pourtant « verified » — la pastille
 * est rouge pleine et ne s'arrête pas, ce qui est pire que gris.
 *
 * On le déplace donc, tout de suite et visiblement, sur la ligne où il se
 * liera. Le serveur LSP fait le calcul (il tient la language map du document
 * ouvert) ; sans serveur, on ne touche à rien.
 */
async function snapBreakpoints(
    breakpoints: readonly vscode.Breakpoint[]): Promise<void> {

    if (!client || snapping) { return; }
    const byFile = new Map<string, vscode.SourceBreakpoint[]>();
    for (const bp of breakpoints) {
        if (!(bp instanceof vscode.SourceBreakpoint)) { continue; }
        const uri = bp.location.uri;
        if (!uri.fsPath.endsWith('.ldpy')) { continue; }
        const key = uri.toString();
        const bucket = byFile.get(key);
        if (bucket) { bucket.push(bp); } else { byFile.set(key, [bp]); }
    }
    if (!byFile.size) { return; }

    const remove: vscode.Breakpoint[] = [];
    const add: vscode.Breakpoint[] = [];
    for (const [uri, bps] of byFile) {
        // LSP : lignes 1-based, comme le débogueur ; VS Code compte de 0.
        const lines = bps.map(b => b.location.range.start.line + 1);
        let snapped: number[];
        try {
            const r = await client.sendRequest<{ lines: number[] }>(
                'ldpy/breakpointLines', { textDocument: { uri }, lines });
            snapped = r?.lines ?? lines;
        } catch { continue; }
        snapped.forEach((line, i) => {
            if (line === lines[i]) { return; }
            const bp = bps[i];
            const pos = new vscode.Position(line - 1, 0);
            remove.push(bp);
            add.push(new vscode.SourceBreakpoint(
                new vscode.Location(bp.location.uri, pos),
                bp.enabled, bp.condition, bp.hitCondition, bp.logMessage));
        });
    }
    if (!remove.length) { return; }
    // Le remplacement redéclenche l'événement : ce drapeau évite la boucle
    // (les nouvelles lignes sont stables, mais mieux vaut ne pas en dépendre).
    snapping = true;
    try {
        vscode.debug.removeBreakpoints(remove);
        vscode.debug.addBreakpoints(add);
    } finally {
        snapping = false;
    }
}

// ---------------------------------------------------------------- commandes

/** Lance `python -m ldpy.debug --breakpoints 0 ...` et rend le JSON
 * {shadow, map, breakpoints} — utilisé pour montrer le fantôme. */
function shadowInfo(python: string, file: string, buildDir: string):
    Promise<{ shadow: string; map: string }> {
    return new Promise((resolve, reject) => {
        const args = ['-m', 'ldpy.debug', file, '-o', buildDir,
            '--breakpoints', '0'];
        cp.execFile(python, args,
            { cwd: path.dirname(file) }, (err, stdout, stderr) => {
                if (err) { reject(new Error(stderr || String(err))); return; }
                resolve(JSON.parse(stdout));
            });
    });
}

/** Formate tous les .ldpy de l'espace de travail — ce que « Format Document »
 * ne sait pas faire, et la seule raison d'ajouter une commande de formatage. */
async function formatWorkspace() {
    const files = await vscode.workspace.findFiles(
        '**/*.ldpy', '**/{node_modules,.venv,.ldpy-build,site}/**');
    if (!files.length) {
        vscode.window.showInformationMessage('ldpy : aucun fichier .ldpy.');
        return;
    }
    let changed = 0;
    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `ldpy : formatage de ${files.length} fichier(s)…`,
    }, async () => {
        for (const uri of files) {
            const doc = await vscode.workspace.openTextDocument(uri);
            const edits = await vscode.commands.executeCommand<
                vscode.TextEdit[]>('vscode.executeFormatDocumentProvider',
                    uri, { tabSize: 4, insertSpaces: true });
            if (!edits?.length) { continue; }
            const edit = new vscode.WorkspaceEdit();
            edit.set(uri, edits);
            if (await vscode.workspace.applyEdit(edit)) {
                await doc.save();
                changed++;
            }
        }
    });
    vscode.window.showInformationMessage(
        `ldpy : ${changed} fichier(s) reformaté(s) sur ${files.length}.`);
}

/** Le sélecteur de l'extension Python quand elle est là — sinon le réglage. */
async function selectInterpreter() {
    if (vscode.extensions.getExtension('ms-python.python')) {
        try {
            await vscode.commands.executeCommand('python.setInterpreter');
            return;
        } catch { /* la commande a changé de nom : on retombe */ }
    }
    await vscode.commands.executeCommand('workbench.action.openSettings',
        'ldpy.pythonPath');
}

async function debugCurrentFile() {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'ldpy') { return; }
    await vscode.debug.startDebugging(
        vscode.workspace.getWorkspaceFolder(editor.document.uri), {
        type: 'ldpy', request: 'launch',
        name: `ldpy : ${path.basename(editor.document.uri.fsPath)}`,
        program: editor.document.uri.fsPath,
    });
}

async function showShadow() {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'ldpy') { return; }
    await editor.document.save();
    const file = editor.document.uri.fsPath;
    const { buildDir } = config();
    try {
        const info = await shadowInfo(await resolvePython(), file, buildDir);
        const doc = await vscode.workspace.openTextDocument(
            vscode.Uri.file(info.shadow));
        await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
    } catch (e) {
        vscode.window.showErrorMessage(`ldpy : ${(e as Error).message}`);
    }
}

async function runCurrentFile() {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'ldpy') { return; }
    await editor.document.save();
    const python = await resolvePython();
    const term = vscode.window.terminals.find(t => t.name === 'ldpy')
        ?? vscode.window.createTerminal('ldpy');
    term.show();
    term.sendText(`${python} -m ldpy "${editor.document.uri.fsPath}"`);
}

export async function activate(context: vscode.ExtensionContext) {
    const provider = new LdpyDebugConfigurationProvider();
    output = vscode.window.createOutputChannel('ldpy');
    status = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Right, 100);
    context.subscriptions.push(
        status, output,
        vscode.window.onDidChangeActiveTextEditor(updateStatusVisibility),
        vscode.commands.registerCommand('ldpy.selectInterpreter',
            selectInterpreter),
        vscode.commands.registerCommand('ldpy.run', runCurrentFile),
        vscode.commands.registerCommand('ldpy.debug', debugCurrentFile),
        vscode.commands.registerCommand('ldpy.showTranspiled', showShadow),
        vscode.commands.registerCommand('ldpy.formatWorkspace', formatWorkspace),
        vscode.commands.registerCommand('ldpy.showServerOutput',
            () => output?.show(true)),
        vscode.commands.registerCommand('ldpy.openDocumentation',
            () => vscode.env.openExternal(vscode.Uri.parse(
                'https://linked-data-python.readthedocs.io/'))),
        vscode.commands.registerCommand('ldpy.restartServer', async () => {
            await client?.stop();
            await startClient(context);
        }),
        // Les réglages du serveur sont passés à son démarrage : les changer
        // demande un redémarrage, qu'on fait ici plutôt que de le demander.
        vscode.workspace.onDidChangeConfiguration(async (e) => {
            if (e.affectsConfiguration('ldpy.backend')
                || e.affectsConfiguration('ldpy.lineLength')
                || e.affectsConfiguration('ldpy.pythonPath')) {
                await client?.stop();
                await startClient(context);
            }
        }),
        vscode.debug.registerDebugConfigurationProvider('ldpy', provider),
        vscode.debug.registerDebugConfigurationProvider('ldpy', provider,
            vscode.DebugConfigurationProviderTriggerKind.Dynamic),
        vscode.debug.onDidChangeBreakpoints(
            e => { void snapBreakpoints([...e.added, ...e.changed]); }),
    );
    updateStatusVisibility();
    try {
        await startClient(context);
    } catch (e) {
        vscode.window.showWarningMessage((e as Error).message);
    }
}

export function deactivate(): Thenable<void> | undefined {
    return client?.stop();
}
