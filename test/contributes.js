'use strict';
/**
 * Le `package.json` et `src/extension.ts` doivent dire la MÊME chose.
 *
 * Une commande contribuée mais non enregistrée donne « command not found »
 * au clic ; une commande enregistrée mais non contribuée est invisible. Les
 * deux erreurs sont silencieuses jusqu'à ce qu'un utilisateur les rencontre,
 * et aucune ne se voit à la compilation — d'où ce test.
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.join(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const src = fs.readFileSync(path.join(root, 'src', 'extension.ts'), 'utf8');

const contributed = pkg.contributes.commands.map(c => c.command).sort();
const registered = [...src.matchAll(/registerCommand\(\s*'([^']+)'/g)]
    .map(m => m[1]).sort();

assert.deepStrictEqual(registered, contributed,
    'commandes contribuées et enregistrées divergentes');

// Tout ce que les menus référencent doit exister.
for (const [menu, items] of Object.entries(pkg.contributes.menus || {})) {
    for (const item of items) {
        assert.ok(contributed.includes(item.command),
            `menu ${menu} : commande inconnue ${item.command}`);
    }
}

// Les réglages lus par le code doivent être déclarés (sinon ils ne sont ni
// documentés, ni proposés, et leur défaut est celui du code — invisible).
const declared = Object.keys(pkg.contributes.configuration.properties);
for (const m of src.matchAll(/c\.get<[^>]+>\('([^']+)'/g)) {
    assert.ok(declared.includes('ldpy.' + m[1]),
        `réglage lu mais non déclaré : ldpy.${m[1]}`);
}

// Chaque réglage a une portée explicite et une description.
for (const [name, prop] of Object.entries(
    pkg.contributes.configuration.properties)) {
    assert.ok(prop.scope, `${name} : portée (scope) manquante`);
    assert.ok(prop.description || prop.markdownDescription,
        `${name} : description manquante`);
}

// Aucun raccourci par défaut : décision de la fiche vscode/105.
assert.ok(!pkg.contributes.keybindings,
    'un raccourci par défaut est apparu — voir la fiche vscode/105');

console.log('ok     commandes, menus et réglages cohérents (%d commandes, %d réglages)',
    contributed.length, declared.length);
