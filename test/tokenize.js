/** Tokenisation TextMate hors VS Code (vscode-textmate + oniguruma). */
'use strict';
const fs = require('fs');
const path = require('path');
const vsctm = require('vscode-textmate');
const oniguruma = require('vscode-oniguruma');

const SYN = path.join(__dirname, '..', 'syntaxes');
const { magicPythonPath } = require(path.join(SYN, 'highlight-pkg'));
const GRAMMARS = {
    // MagicPython est vendoré par linked-data-python-highlight : un seul
    // exemplaire dans l'espace de travail (ldpy/021).
    'source.python': magicPythonPath(),
    'source.ldpy': path.join(SYN, 'ldpy.tmLanguage.json'),
};

let registry = null;

function getRegistry() {
    if (!registry) {
        const wasm = fs.readFileSync(
            path.join(require.resolve('vscode-oniguruma'), '..', 'onig.wasm')).buffer;
        const onigLib = oniguruma.loadWASM(wasm).then(() => ({
            createOnigScanner: (s) => new oniguruma.OnigScanner(s),
            createOnigString: (s) => new oniguruma.OnigString(s),
        }));
        registry = new vsctm.Registry({
            onigLib,
            loadGrammar: async (scopeName) => {
                const p = GRAMMARS[scopeName];
                return p ? vsctm.parseRawGrammar(fs.readFileSync(p, 'utf8'), p) : null;
            },
        });
    }
    return registry;
}

/** Tokenise `text` avec la grammaire de `scopeName`.
 * Retourne, par ligne, des tokens {text, start, scopes} — la racine
 * (source.python / source.ldpy) est retirée pour permettre la comparaison. */
async function tokenize(scopeName, text) {
    const grammar = await getRegistry().loadGrammar(scopeName);
    let stack = vsctm.INITIAL;
    return text.split('\n').map((line) => {
        const r = grammar.tokenizeLine(line, stack);
        stack = r.ruleStack;
        return r.tokens.map((t) => ({
            text: line.substring(t.startIndex, t.endIndex),
            start: t.startIndex,
            scopes: t.scopes.slice(1),
        }));
    });
}

/** Carte position -> scopes (chaîne) d'une ligne tokenisée. */
function charScopes(lineTokens) {
    const m = [];
    for (const t of lineTokens) {
        for (let c = 0; c < t.text.length; c++) m[t.start + c] = t.scopes.join(' ');
    }
    return m;
}

module.exports = { tokenize, charScopes };
