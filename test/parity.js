#!/usr/bin/env node
/**
 * Tests de la grammaire ldpy (npm test) :
 *
 * 1. dérive : syntaxes/ldpy.tmLanguage.json == sortie de generate.js ;
 * 2. regex : chaque match/begin compile sous oniguruma (les end/while
 *    peuvent référencer des captures du begin : backrefs substituées) ;
 * 3. PARITÉ : un fichier Python pur (test/fixtures/pure_*.py) reçoit
 *    exactement les mêmes scopes en .ldpy qu'avec MagicPython — au
 *    caractère près (fiche vscode/102) ;
 * 4. îlots : golden sur test/fixtures/islands.ldpy
 *    (UPDATE_GOLDEN=1 npm test pour régénérer).
 */
'use strict';
const cp = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const oniguruma = require('vscode-oniguruma');
const { tokenize, charScopes } = require('./tokenize');

const ROOT = path.join(__dirname, '..');
const GRAMMAR = path.join(ROOT, 'syntaxes', 'ldpy.tmLanguage.json');
const FIXTURES = path.join(__dirname, 'fixtures');
let failures = 0;

function fail(msg) {
    failures++;
    console.error(`ÉCHEC  ${msg}`);
}

// ------------------------------------------------------------- 1. dérive

function checkGenerated() {
    const tmp = path.join(os.tmpdir(), `ldpy-grammar-${process.pid}.json`);
    cp.execFileSync(process.execPath,
        [path.join(ROOT, 'syntaxes', 'generate.js'), tmp], { stdio: 'pipe' });
    const fresh = fs.readFileSync(tmp, 'utf8');
    fs.unlinkSync(tmp);
    if (fresh !== fs.readFileSync(GRAMMAR, 'utf8')) {
        fail('ldpy.tmLanguage.json ne correspond pas à generate.js — lancer `npm run generate`');
    } else {
        console.log('ok     grammaire = sortie du générateur');
    }
}

// -------------------------------------------------------------- 2. regex

async function checkRegexes() {
    const wasm = fs.readFileSync(
        path.join(require.resolve('vscode-oniguruma'), '..', 'onig.wasm')).buffer;
    await oniguruma.loadWASM(wasm).catch(() => { });
    const g = JSON.parse(fs.readFileSync(GRAMMAR, 'utf8'));
    let bad = 0;
    (function walk(node, where) {
        if (Array.isArray(node)) return node.forEach((n, i) => walk(n, `${where}[${i}]`));
        if (!node || typeof node !== 'object') return;
        for (const key of ['match', 'begin', 'end', 'while']) {
            if (typeof node[key] !== 'string') continue;
            // end/while : les \1 \2… viennent des captures du begin
            const re = (key === 'end' || key === 'while')
                ? node[key].replace(/\\\d+/g, 'x') : node[key];
            try { new oniguruma.OnigScanner([re]); } catch (e) {
                bad++;
                fail(`${where}.${key} ne compile pas (${e.message}) : ${re.slice(0, 80)}`);
            }
        }
        for (const [k, v] of Object.entries(node)) {
            if (!['match', 'begin', 'end', 'while'].includes(k)) walk(v, `${where}.${k}`);
        }
    })(g.repository, 'repository');
    if (!bad) console.log('ok     toutes les regex compilent');
}

// ------------------------------------------------------------- 3. parité

async function checkParity(file) {
    const text = fs.readFileSync(path.join(FIXTURES, file), 'utf8');
    const lines = text.split('\n');
    const py = await tokenize('source.python', text);
    const ldpy = await tokenize('source.ldpy', text);
    let diffs = 0;
    for (let i = 0; i < lines.length; i++) {
        const a = charScopes(py[i]), b = charScopes(ldpy[i]);
        for (let c = 0; c < lines[i].length; c++) {
            if ((a[c] || '') !== (b[c] || '')) {
                if (++diffs <= 5) {
                    fail(`${file}:${i + 1}:${c + 1} «${lines[i][c]}» dans « ${lines[i].trim()} »\n` +
                        `       .py   : ${a[c] || '(rien)'}\n` +
                        `       .ldpy : ${b[c] || '(rien)'}`);
                }
                break; // une divergence par ligne suffit au rapport
            }
        }
    }
    if (!diffs) console.log(`ok     parité Python pur : ${file}`);
    else failures += 0; // déjà compté via fail()
}

// ------------------------------------------------------------- 4. golden

async function checkGolden() {
    const src = fs.readFileSync(path.join(FIXTURES, 'islands.ldpy'), 'utf8');
    const toks = await tokenize('source.ldpy', src);
    const lines = src.split('\n');
    const out = [];
    toks.forEach((lineToks, i) => {
        for (const t of lineToks) {
            if (!t.text.trim()) continue;
            out.push(`${i + 1}:${t.start + 1} «${t.text}» ${t.scopes.join(' ') || '-'}`);
        }
        if (lineToks.length) out.push('');
    });
    void lines;
    const goldenPath = path.join(FIXTURES, 'islands.golden.txt');
    const fresh = out.join('\n');
    if (process.env.UPDATE_GOLDEN) {
        fs.writeFileSync(goldenPath, fresh);
        console.log('ok     golden îlots régénéré (UPDATE_GOLDEN)');
        return;
    }
    const golden = fs.existsSync(goldenPath) ? fs.readFileSync(goldenPath, 'utf8') : '';
    if (fresh !== golden) {
        const a = golden.split('\n'), b = fresh.split('\n');
        for (let i = 0; i < Math.max(a.length, b.length); i++) {
            if (a[i] !== b[i]) {
                fail(`golden îlots, première divergence :\n       attendu : ${a[i]}\n       obtenu  : ${b[i]}`);
                break;
            }
        }
    } else {
        console.log('ok     golden îlots');
    }
}

(async () => {
    checkGenerated();
    await checkRegexes();
    for (const f of fs.readdirSync(FIXTURES).filter((f) => /^pure_.*\.py$/.test(f))) {
        await checkParity(f);
    }
    await checkGolden();
    console.log(failures ? `\n${failures} échec(s).` : '\nTout est vert.');
    process.exit(failures ? 1 : 0);
})();
