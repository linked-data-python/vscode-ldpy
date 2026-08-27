/**
 * Extension VS Code Linked-Data Python (fiche DESIGN_CHOICES/vscode/102).
 *
 * - Client LSP vers `python -m ldpy.lsp` (diagnostics, complétion, hover,
 *   définition, références, semantic tokens des îlots).
 * - `ldpy: Run current file`   : exécute via `python -m ldpy` dans un terminal.
 * - `ldpy: Debug current file` : matérialise le fantôme (`python -m ldpy.debug
 *   --breakpoints`), re-pose les breakpoints du .ldpy sur le fantôme aux
 *   lignes traduites, puis démarre une session de débogage Python dessus
 *   (l'extension Python/debugpy fait le reste — aucun adaptateur à écrire).
 * - `ldpy: Show transpiled Python (shadow)` : ouvre le fantôme à côté.
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
        python: c.get<string>('pythonPath', 'python3'),
        backend: c.get<string>('backend', 'pylsp'),
        buildDir: c.get<string>('buildDirectory', '.ldpy-build'),
    };
}

async function startClient(context: vscode.ExtensionContext) {
    const { python, backend } = config();
    const serverOptions: ServerOptions = {
        command: python,
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

/** Lance `python -m ldpy.debug --breakpoints ...` et rend le JSON. */
function shadowInfo(python: string, file: string, buildDir: string,
                    lines: number[]): Promise<{
                        shadow: string; map: string;
                        breakpoints: Record<string, number | null>;
                    }> {
    return new Promise((resolve, reject) => {
        const args = ['-m', 'ldpy.debug', file, '-o', buildDir,
                      '--breakpoints', lines.length ? lines.join(',') : '0'];
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
    await editor.document.save();
    const file = editor.document.uri.fsPath;
    const { python, buildDir } = config();

    // les breakpoints posés dans CE .ldpy, en lignes 1-based
    const bps = vscode.debug.breakpoints
        .filter((b): b is vscode.SourceBreakpoint =>
            b instanceof vscode.SourceBreakpoint &&
            b.location.uri.fsPath === file)
        .map(b => b.location.range.start.line + 1);

    let info;
    try {
        info = await shadowInfo(python, file, buildDir, bps);
    } catch (e) {
        vscode.window.showErrorMessage(`ldpy : ${(e as Error).message}`);
        return;
    }

    // re-poser les breakpoints traduits sur le fantôme
    const shadowUri = vscode.Uri.file(info.shadow);
    const translated: vscode.SourceBreakpoint[] = [];
    for (const line of Object.values(info.breakpoints)) {
        if (typeof line === 'number') {
            translated.push(new vscode.SourceBreakpoint(new vscode.Location(
                shadowUri, new vscode.Position(line - 1, 0))));
        }
    }
    if (translated.length) { vscode.debug.addBreakpoints(translated); }

    await vscode.debug.startDebugging(
        vscode.workspace.getWorkspaceFolder(editor.document.uri), {
            type: 'python', request: 'launch',
            name: `ldpy: ${path.basename(file)}`,
            program: info.shadow,
            console: 'integratedTerminal',
            justMyCode: true,
        });
}

async function showShadow() {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'ldpy') { return; }
    await editor.document.save();
    const file = editor.document.uri.fsPath;
    const { python, buildDir } = config();
    try {
        const info = await shadowInfo(python, file, buildDir, []);
        const doc = await vscode.workspace.openTextDocument(
            vscode.Uri.file(info.shadow));
        await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
    } catch (e) {
        vscode.window.showErrorMessage(`ldpy : ${(e as Error).message}`);
    }
}

function runCurrentFile() {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'ldpy') { return; }
    editor.document.save();
    const { python } = config();
    const term = vscode.window.terminals.find(t => t.name === 'ldpy')
        ?? vscode.window.createTerminal('ldpy');
    term.show();
    term.sendText(`${python} -m ldpy "${editor.document.uri.fsPath}"`);
}

export async function activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(
        vscode.commands.registerCommand('ldpy.run', runCurrentFile),
        vscode.commands.registerCommand('ldpy.debug', debugCurrentFile),
        vscode.commands.registerCommand('ldpy.showShadow', showShadow),
        vscode.commands.registerCommand('ldpy.restartServer', async () => {
            await client?.stop();
            await startClient(context);
        }),
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
