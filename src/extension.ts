/**
 * Extension VS Code Linked-Data Python (fiche DESIGN_CHOICES/vscode/102).
 *
 * - Client LSP vers `python -m ldpy.lsp` (diagnostics, complétion, hover,
 *   définition, références, semantic tokens des îlots).
 * - Débogage NATIF (F5, type `ldpy`) : la configuration est traduite en une
 *   session debugpy sur `python -m ldpy.debug --run fichier.ldpy` — le code
 *   est compilé en coordonnées source (fiche ldpy/011), les breakpoints
 *   posés dans le .ldpy se lient donc directement, sans fantôme ni
 *   traduction. Aucun adaptateur DAP à écrire.
 * - `ldpy: Run current file`   : exécute via `python -m ldpy` dans un terminal.
 * - `ldpy: Show transpiled Python (shadow)` : ouvre le fantôme à côté.
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

function config() {
    const c = vscode.workspace.getConfiguration('ldpy');
    return {
        backend: c.get<string>('backend', 'pylsp'),
        buildDir: c.get<string>('buildDirectory', '.ldpy-build'),
    };
}

/** Interpréteur Python : réglage explicite > extension Python > python3. */
async function resolvePython(): Promise<string> {
    const c = vscode.workspace.getConfiguration('ldpy');
    const insp = c.inspect<string>('pythonPath');
    const explicit = insp?.workspaceFolderValue ?? insp?.workspaceValue
        ?? insp?.globalValue;
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
    return c.get<string>('pythonPath', 'python3');
}

/** Vérifie que le paquet ldpy est importable par cet interpréteur. */
function checkLdpy(python: string): Promise<boolean> {
    return new Promise((resolve) => {
        cp.execFile(python, ['-c', 'import ldpy'],
            (err) => resolve(!err));
    });
}

async function startClient(context: vscode.ExtensionContext) {
    const { backend } = config();
    const serverOptions: ServerOptions = {
        command: await resolvePython(),
        args: ['-m', 'ldpy.lsp', '--backend', backend],
    };
    const clientOptions: LanguageClientOptions = {
        documentSelector: [{ language: 'ldpy' }],
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
        if (!(await checkLdpy(python))) {
            vscode.window.showErrorMessage(
                `ldpy : paquet introuvable pour « ${python} ». ` +
                'Installer linked-data-python dans cet environnement ou ' +
                'régler ldpy.pythonPath.');
            return null;
        }

        const debugpyType = vscode.extensions.getExtension('ms-python.debugpy')
            ? 'debugpy' : 'python';
        const args = ['--run', program];
        if (Array.isArray(cfg.args) && cfg.args.length) {
            args.push('--', ...cfg.args);
        }
        // On démarre nous-mêmes la session Python équivalente, puis on
        // annule silencieusement la session « ldpy » (retour null) : c'est
        // le schéma supporté pour déléguer à un autre débogueur.
        await vscode.debug.startDebugging(
            folder ?? vscode.workspace.getWorkspaceFolder(
                vscode.Uri.file(program)), {
            type: debugpyType, request: 'launch',
            name: cfg.name || `ldpy : ${path.basename(program)}`,
            module: 'ldpy.debug', args, python,
            console: cfg.console ?? 'integratedTerminal',
            justMyCode: cfg.justMyCode ?? true,
            cwd: cfg.cwd ?? path.dirname(program),
            env: cfg.env,
        });
        return null;
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
    context.subscriptions.push(
        vscode.commands.registerCommand('ldpy.run', runCurrentFile),
        vscode.commands.registerCommand('ldpy.debug', debugCurrentFile),
        vscode.commands.registerCommand('ldpy.showShadow', showShadow),
        vscode.commands.registerCommand('ldpy.restartServer', async () => {
            await client?.stop();
            await startClient(context);
        }),
        vscode.debug.registerDebugConfigurationProvider('ldpy', provider),
        vscode.debug.registerDebugConfigurationProvider('ldpy', provider,
            vscode.DebugConfigurationProviderTriggerKind.Dynamic),
    );
    try {
        await startClient(context);
    } catch (e) {
        vscode.window.showWarningMessage(
            `ldpy : serveur LSP indisponible (${(e as Error).message}). ` +
            `Vérifier ldpy.pythonPath et \`pip install linked-data-python\`.`);
    }
}

export function deactivate(): Thenable<void> | undefined {
    return client?.stop();
}
