#!/usr/bin/env node
/**
 * Génère syntaxes/ldpy.tmLanguage.json : MagicPython officiel (vendored dans
 * syntaxes/upstream/, copié de VS Code) + îlots RDF/SPARQL de ldpy.
 *
 * Doctrine (DESIGN_CHOICES/vscode/102, règles DESIGN_CHOICES/ldpy/002) :
 * un fichier Python pur doit être coloré EXACTEMENT comme en .py. Les règles
 * d'îlot ne s'appliquent donc qu'à des positions où la construction serait
 * invalide en Python pur :
 *
 * - `<iri>`, `f<`, `e<` : contexte opérande (R1) — `<` n'y est jamais du
 *   Python valide ; `a<b>c` (comparaison chaînée) reste du Python.
 * - `g{`, `f{`, `e{`, `s{`, `m{`, `?{` : NAME{ collé n'est jamais du Python
 *   valide (R2). `s{…}` colore du SPARQL (accolades internes équilibrées) ;
 *   `m{…}` colore comme un graphe (BGP à variables).
 * - `+{`, `-{` en tête de ligne : îlots d'ajout/retrait (fiche 014) — du
 *   Python légal mais sémantiquement mort, la capture ne coûte rien.
 * - `@graph`/`@bindings` en tête de ligne suivis d'un opérande (fiche 014/017),
 *   avec `global`/`nonlocal` en modificateur (fiche 018) ; un décorateur
 *   (`@graph` nu, `@graph(...)`, `@graph.attr`) reste un décorateur.
 * - `for @bindings [as b] in …` (fiche 017) : `for @` n'est jamais du Python.
 * - `from m import brick:, u: as v:` (fiche 013) : un pname dans une liste
 *   d'import n'est jamais du Python valide.
 * - `?var`, `$var` : jamais du Python valide.
 * - `"…"@lang`, `"…"^^dt` collés : jamais du Python valide (R2).
 * - pname `ex:local` et bnode `_:b` : SEULEMENT après `=` d'affectation,
 *   return/yield/await, ou en position d'élément d'appel/liste/parenthèses —
 *   partout où `NAME:NAME` serait invalide en Python. Les positions
 *   ambiguës (slices `d[i:j]`, dicts `{k:v}`, annotations `x:int`,
 *   suites collées `if x:pass`, opérateurs arithmétiques) restent colorées
 *   comme du Python ; les semantic tokens du LSP raffinent (fiche 102).
 * - les subscripts `d[…]`, `(a)[…]`, `"s"[…]` et les dict/set `{…}`
 *   basculent sur une chaîne d'expressions SANS pname (`#expression-nop`),
 *   car `a[ex:b]` et `{ex:b}` y sont du Python valide (slice / paire).
 *
 * Vérification : `npm test` (test/parity.js) — identité caractère par
 * caractère avec MagicPython sur du Python pur, golden sur les îlots.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const UPSTREAM = path.join(__dirname, 'upstream', 'MagicPython.tmLanguage.json');
const OUT = process.argv[2] || path.join(__dirname, 'ldpy.tmLanguage.json');

const g = JSON.parse(fs.readFileSync(UPSTREAM, 'utf8'));
g.name = 'ldpy';
g.scopeName = 'source.ldpy';
g.information_for_contributors = [
    'FICHIER GÉNÉRÉ par syntaxes/generate.js — ne pas éditer à la main.',
    'Base : MagicPython vendored (syntaxes/upstream/, copié de VS Code) ; les scopes',
    'Python gardent le suffixe .python pour hériter des règles de thème exactes,',
    'les îlots ldpy portent le suffixe .ldpy.',
    'Régénérer : npm run generate — vérifier : npm test.',
];

const R = g.repository;
const inc = (name) => ({ include: name });

// ---------------------------------------------------------------- contextes

// R1 — contexte opérande : sûr pour `<…>`/`f<`/`e<` (jamais du Python valide
// à ces positions). NB : `[` échappé (sinon oniguruma lit `[=` comme une
// classe POSIX et la regex ne compile pas — bug historique de la v1 du
// portage, les IRIs n'étaient jamais colorées).
const OPERAND = String.raw`(?:^|(?<=[=+\-*/%,;:!|&^~(\[{<])` +
    String.raw`|(?<=\breturn)|(?<=\byield)|(?<=\belse)|(?<=\bin)|(?<=\bis)` +
    String.raw`|(?<=\bnot)|(?<=\band)|(?<=\bor)|(?<=\bif)|(?<=\bawait))`;

// pname/bnode — STRICT : uniquement après un `=` d'affectation (pas ==, +=,
// <=… ; := accepté), return/yield/await. Ailleurs, NAME:NAME peut être du
// Python valide (slices, annotations, suites collées `if x==y:pass`).
const STRICT = String.raw`(?:(?<==)(?<![=!<>+\-*/%&|^~]=)` +
    String.raw`|(?<=\breturn)|(?<=\byield)|(?<=\bawait))`;

// pname/bnode — élément d'un appel f(…), d'une liste ou de parenthèses :
// `NAME:NAME` y est toujours invalide en Python.
const ARGS = String.raw`(?:^|(?<=[(,=\[]))`;

const IRIREF = String.raw`<[^<>"{}|^` + '`' + String.raw`\\\s]*>`;
const PNAME_PARTS =
    String.raw`([A-Za-z_]\w*)(:)([A-Za-z_]\w*(?:\{[^}]*\})?|\{[^}]*\})`;
const BNODE_PARTS = String.raw`(_:)(\w+|\{[^}]*\})`;

const PNAME_CAPTURES = {
    2: { name: 'entity.name.type.pname.prefix.ldpy' },
    3: { name: 'punctuation.separator.pname.ldpy' },
    4: { name: 'entity.name.other.pname.local.ldpy' },
};
const BNODE_CAPTURES = {
    2: { name: 'punctuation.definition.bnode.ldpy' },
    3: { name: 'entity.name.other.bnode.ldpy' },
};

// interpolation {expr} d'un f<…>, e<…>, ou d'un g{…}
const interpolation = {
    begin: String.raw`\{`,
    end: String.raw`\}`,
    beginCaptures: { 0: { name: 'punctuation.section.interpolation.begin.ldpy' } },
    endCaptures: { 0: { name: 'punctuation.section.interpolation.end.ldpy' } },
    patterns: [inc('#expression')],
};

function braceIsland(key, letterRe, storage) {
    return {
        begin: String.raw`\b(` + letterRe + String.raw`)(\{)`,
        end: String.raw`\}`,
        beginCaptures: {
            1: { name: `storage.type.${storage}.ldpy` },
            2: { name: `punctuation.definition.${storage}.begin.ldpy` },
        },
        endCaptures: { 0: { name: `punctuation.definition.${storage}.end.ldpy` } },
        patterns: [inc(key)],
    };
}

// garde de fermeture : l'îlot f<…>/e<…> n'est pris que si un `>` ferme sur
// la même ligne avec le jeu de caractères IRI (interpolations {…} admises) —
// sinon repli comparaison, comme le backtracking R3 du transpileur.
const IRI_CLOSES = String.raw`(?=(?:[^<>"|^` + '`' + String.raw`\\\s{}]|\{[^}]*\})*>)`;

function iriTemplate(letter, kind, operandGuard) {
    return {
        begin: (operandGuard ? OPERAND + String.raw`(\s*)` : '') +
            String.raw`\b(` + letter + String.raw`)(<)` + IRI_CLOSES,
        end: '>',
        contentName: `string.interpolated.${kind}.ldpy`,
        beginCaptures: operandGuard ? {
            2: { name: `storage.type.${kind}.ldpy` },
            3: { name: `punctuation.definition.${kind}.begin.ldpy` },
        } : {
            1: { name: `storage.type.${kind}.ldpy` },
            2: { name: `punctuation.definition.${kind}.begin.ldpy` },
        },
        endCaptures: { 0: { name: `punctuation.definition.${kind}.end.ldpy` } },
        patterns: [interpolation],
    };
}

function directive(keyword, guard) {
    return {
        name: `meta.directive.${keyword}.ldpy`,
        begin: String.raw`^\s*(@` + keyword + String.raw`)` + guard,
        end: String.raw`(?=\n|#)`,
        beginCaptures: { 1: { name: `keyword.other.${keyword}.ldpy` } },
        patterns: [
            {
                match: String.raw`([A-Za-z_][\w.-]*)?(:)`,
                captures: {
                    1: { name: 'entity.name.type.pname.prefix.ldpy' },
                    2: { name: 'punctuation.separator.pname.ldpy' },
                },
            },
            { match: IRIREF, name: 'string.quoted.other.iriref.ldpy' },
            { match: String.raw`\.`, name: 'punctuation.terminator.directive.ldpy' },
            { match: String.raw`[^\s#]+`, name: 'invalid.illegal.directive.ldpy' },
        ],
    };
}

// ------------------------------------------------------------------- îlots

const islands = {
    // @prefix / @base : gardés par la forme complète de la directive, pour
    // qu'un décorateur Python nommé `prefix` ou `base` reste un décorateur.
    'ldpy-prefix': directive('prefix', String.raw`(?=\s+(?:[A-Za-z_][\w.-]*)?:\s*<)`),
    'ldpy-base': directive('base', String.raw`(?=\s+<)`),

    'ldpy-graph': braceIsland('#ldpy-graph-content', 'g', 'graph'),
    'ldpy-match': braceIsland('#ldpy-graph-content', 'm', 'match'),
    'ldpy-sparql': braceIsland('#ldpy-sparql-content', 's', 'sparql'),
    'ldpy-enode': braceIsland('#expression', 'e', 'sparql-expr'),

    // +{ … } / -{ … } : ajout/retrait sur le graphe courant (fiche 014),
    // en tête de ligne logique uniquement.
    'ldpy-addremove': {
        begin: String.raw`^\s*([+-])(\{)`,
        end: String.raw`\}`,
        beginCaptures: {
            1: { name: 'storage.type.addremove.ldpy' },
            2: { name: 'punctuation.definition.addremove.begin.ldpy' },
        },
        endCaptures: { 0: { name: 'punctuation.definition.addremove.end.ldpy' } },
        patterns: [inc('#ldpy-graph-content')],
    },

    // @graph / @bindings (fiches 014/017), modificateur global/nonlocal
    // (fiche 018). Un décorateur (@graph nu, @graph(...), @graph.attr)
    // reste un décorateur : garde sur l'opérande qui suit.
    'ldpy-graph-decl': contextDecl('graph'),
    'ldpy-bindings-decl': contextDecl('bindings'),

    // for @bindings [as b] in … (fiche 017)
    'ldpy-for-bindings': {
        match: String.raw`(?<=\bfor\s)\s*(@bindings)\b(?:\s+(as)\s+([A-Za-z_]\w*))?`,
        captures: {
            1: { name: 'keyword.other.bindings.ldpy' },
            2: { name: 'keyword.control.flow.python' },
            3: { name: 'variable.other.ldpy' },
        },
    },

    // pname dans une liste d'import (fiche 013) : brick:, unit: as u:
    'ldpy-import-prefix': {
        match: String.raw`([A-Za-z_][\w.-]*)?(:)(?=\s*[,)\n#]|\s+as\b|\s*$)`,
        captures: {
            1: { name: 'entity.name.type.pname.prefix.ldpy' },
            2: { name: 'punctuation.separator.pname.ldpy' },
        },
    },
    'ldpy-fnode': {
        begin: String.raw`(\bf|\?)(\{)`,
        end: String.raw`\}`,
        beginCaptures: {
            1: { name: 'storage.type.fnode.ldpy' },
            2: { name: 'punctuation.definition.fnode.begin.ldpy' },
        },
        endCaptures: { 0: { name: 'punctuation.definition.fnode.end.ldpy' } },
        patterns: [inc('#expression')],
    },

    // f<…>/e<…> : version « -op » (contexte opérande, pour #expression-bare —
    // `f<x>y` reste une comparaison chaînée hors contexte opérande) et
    // version nue (pour l'intérieur des graphes et des directives).
    'ldpy-firi-op': iriTemplate('f', 'firi', true),
    'ldpy-eiri-op': iriTemplate('e', 'eiri', true),
    'ldpy-firi': iriTemplate('f', 'firi', false),
    'ldpy-eiri': iriTemplate('e', 'eiri', false),

    'ldpy-sparql-var': {
        match: String.raw`[?$][A-Za-z_]\w*\b`,
        name: 'variable.other.sparql.ldpy',
    },

    // "…"@lang et "…"^^datatype, collés à la chaîne (R2)
    'ldpy-literal-suffix': {
        patterns: [
            {
                match: String.raw`(?<=["'])(@)([A-Za-z]+(?:-[A-Za-z0-9]+)*)`,
                captures: {
                    1: { name: 'punctuation.definition.langtag.ldpy' },
                    2: { name: 'constant.other.langtag.ldpy' },
                },
            },
            {
                match: String.raw`(?<=["'])(\^\^)` +
                    String.raw`(?:([A-Za-z_]\w*)(:)([A-Za-z_]\w*)|(` + IRIREF + String.raw`))?`,
                captures: {
                    1: { name: 'punctuation.definition.datatype.ldpy' },
                    2: { name: 'entity.name.type.pname.prefix.ldpy' },
                    3: { name: 'punctuation.separator.pname.ldpy' },
                    4: { name: 'entity.name.other.pname.local.ldpy' },
                    5: { name: 'string.quoted.other.iriref.ldpy' },
                },
            },
        ],
    },

    'ldpy-iriref': {
        match: OPERAND + String.raw`(\s*)(` + IRIREF + ')',
        captures: { 2: { name: 'string.quoted.other.iriref.ldpy' } },
    },

    'ldpy-pname': {
        match: STRICT + String.raw`(\s*)` + PNAME_PARTS,
        captures: PNAME_CAPTURES,
    },
    'ldpy-bnode': {
        match: STRICT + String.raw`(\s*)` + BNODE_PARTS,
        captures: BNODE_CAPTURES,
    },
    'ldpy-pname-args': {
        match: ARGS + String.raw`(\s*)` + PNAME_PARTS,
        captures: PNAME_CAPTURES,
    },
    'ldpy-bnode-args': {
        match: ARGS + String.raw`(\s*)` + BNODE_PARTS,
        captures: BNODE_CAPTURES,
    },

    // Subscript après `)`/`]`/`}`/chaîne : MagicPython le tokenise comme une
    // liste ; on reproduit EXACTEMENT ses scopes mais sans pname à
    // l'intérieur (`(a)[i:j]`, `"s"[i:j]` sont des slices Python valides).
    'ldpy-subscript-guard': {
        begin: String.raw`(?<=[\])}"'])\s*(\[)`,
        end: String.raw`(\])`,
        beginCaptures: { 1: { name: 'punctuation.definition.list.begin.python' } },
        endCaptures: { 1: { name: 'punctuation.definition.list.end.python' } },
        patterns: [inc('#expression-nop')],
    },

    // Intérieur d'un g{…} : règles Turtle pleines (fiche 002 R3)
    'ldpy-graph-content': {
        patterns: [
            inc('#comments'),
            { match: String.raw`\ba\b`, name: 'keyword.other.rdf-type.ldpy' },
            inc('#ldpy-sparql-var'),
            inc('#ldpy-firi'),
            inc('#ldpy-eiri'),
            inc('#ldpy-fnode'),
            inc('#ldpy-enode'),
            { ...interpolation, comment: 'interpolation {expr} dans un graphe' },
            { match: IRIREF, name: 'string.quoted.other.iriref.ldpy' },
            {
                match: String.raw`(_:)(\w+|\{[^}]*\})`,
                captures: {
                    1: { name: 'punctuation.definition.bnode.ldpy' },
                    2: { name: 'entity.name.other.bnode.ldpy' },
                },
            },
            {
                match: String.raw`([A-Za-z_]\w*)?(:)([A-Za-z0-9_][\w.-]*)?`,
                captures: {
                    1: { name: 'entity.name.type.pname.prefix.ldpy' },
                    2: { name: 'punctuation.separator.pname.ldpy' },
                    3: { name: 'entity.name.other.pname.local.ldpy' },
                },
            },
            inc('#string'),
            inc('#ldpy-literal-suffix'),
            {
                match: String.raw`[+-]?\d+(\.\d+)?([eE][+-]?\d+)?`,
                name: 'constant.numeric.ldpy',
            },
            {
                match: String.raw`\b(true|false|True|False)\b`,
                name: 'constant.language.ldpy',
            },
            { match: '[;,.]', name: 'punctuation.separator.triples.ldpy' },
            { match: String.raw`[\[\]()]`, name: 'punctuation.section.bnode.ldpy' },
        ],
    },
};

// Intérieur d'un s{…} : coloration SPARQL légère, accolades équilibrées.
// Une interpolation {expr} RE-BASCULE en Python (#expression) ; l'oracle
// exact du transpileur (transpile puis compile) n'existe pas en TextMate,
// l'approximation : contenu sans variable ?/$ ni mot-clé SPARQL sur un
// niveau d'accolades. Les cas ambigus restent colorés en groupe ; les
// semantic tokens du LSP raffinent (fiche 102).
islands['ldpy-sparql-content'] = {
    patterns: [
        inc('#comments'),
        {
            begin: String.raw`\{(?![^{}]*[?$])` +
                String.raw`(?![^{}]*\b(?i:select|filter|optional|union|minus|graph|service|values|bind|where)\b)` +
                String.raw`(?=[^{}]*\})`,
            end: String.raw`\}`,
            beginCaptures: { 0: { name: 'punctuation.section.interpolation.begin.ldpy' } },
            endCaptures: { 0: { name: 'punctuation.section.interpolation.end.ldpy' } },
            patterns: [inc('#expression')],
        },
        { match: String.raw`\b(?i:select|construct|describe|ask|where|from|named|order|by|group|having|limit|offset|distinct|reduced|optional|union|minus|graph|service|silent|filter|bind|values|insert|delete|data|with|using|load|clear|drop|create|copy|move|add|exists|not|in|as|a)\b`,
          name: 'keyword.control.sparql.ldpy' },
        inc('#ldpy-sparql-var'),
        { match: IRIREF, name: 'string.quoted.other.iriref.ldpy' },
        {
            match: String.raw`([A-Za-z_]\w*)?(:)([A-Za-z0-9_][\w.-]*)?`,
            captures: {
                1: { name: 'entity.name.type.pname.prefix.ldpy' },
                2: { name: 'punctuation.separator.pname.ldpy' },
                3: { name: 'entity.name.other.pname.local.ldpy' },
            },
        },
        inc('#string'),
        { match: String.raw`[+-]?\d+(\.\d+)?([eE][+-]?\d+)?`,
          name: 'constant.numeric.ldpy' },
        {
            begin: String.raw`\{`,
            end: String.raw`\}`,
            beginCaptures: { 0: { name: 'punctuation.section.group.sparql.begin.ldpy' } },
            endCaptures: { 0: { name: 'punctuation.section.group.sparql.end.ldpy' } },
            patterns: [inc('#ldpy-sparql-content')],
        },
        { match: '[;,.]', name: 'punctuation.separator.triples.ldpy' },
    ],
};

// déclaration de contexte @graph/@bindings — garde : un opérande suit
// (pas `(`, `.`, `[` ni fin de ligne, qui restent un décorateur).
function contextDecl(keyword) {
    return {
        name: `meta.directive.${keyword}.ldpy`,
        begin: String.raw`^\s*(?:(global|nonlocal)\s+)?(@` + keyword +
            String.raw`)(?=\s+[^\s(.\[#])`,
        end: String.raw`(?=\n|#)`,
        beginCaptures: {
            1: { name: 'storage.modifier.declaration.python' },
            2: { name: `keyword.other.${keyword}.ldpy` },
        },
        patterns: [
            { match: String.raw`\bas\b`, name: 'keyword.control.flow.python' },
            { match: IRIREF, name: 'string.quoted.other.iriref.ldpy' },
            inc('#ldpy-firi'),
            {
                match: String.raw`([A-Za-z_][\w.-]*)(:)([A-Za-z0-9_][\w.-]*)`,
                captures: {
                    1: { name: 'entity.name.type.pname.prefix.ldpy' },
                    2: { name: 'punctuation.separator.pname.ldpy' },
                    3: { name: 'entity.name.other.pname.local.ldpy' },
                },
            },
            inc('#expression'),
        ],
    };
}

Object.assign(R, islands);

// ------------------------------------------------------------- injections

function insertBefore(patterns, anchorInclude, includes) {
    const i = patterns.findIndex((p) => p.include === anchorInclude);
    if (i < 0) {
        throw new Error(`ancre ${anchorInclude} introuvable — MagicPython a changé, adapter generate.js`);
    }
    patterns.splice(i, 0, ...includes.map(inc));
}

// directives @prefix/@base avant les décorateurs
insertBefore(R.statement.patterns, '#decorator', ['#ldpy-base', '#ldpy-prefix']);
// îlots-instructions +{ }/-{ } et déclarations de contexte (dont la forme
// global/nonlocal, fiche 018) : en tête, avant le mot-clé global de
// MagicPython — la garde @graph/@bindings protège le Python pur.
R.statement.patterns.unshift(inc('#ldpy-addremove'),
    inc('#ldpy-graph-decl'), inc('#ldpy-bindings-decl'));

// îlots en tête des expressions
R['expression-bare'].patterns.unshift(...[
    '#ldpy-graph', '#ldpy-match', '#ldpy-sparql', '#ldpy-enode',
    '#ldpy-for-bindings', '#ldpy-firi-op', '#ldpy-eiri-op',
    '#ldpy-fnode', '#ldpy-sparql-var', '#ldpy-literal-suffix',
    '#ldpy-iriref', '#ldpy-bnode', '#ldpy-pname',
].map(inc));
insertBefore(R['expression-bare'].patterns, '#list', ['#ldpy-subscript-guard']);

// pname dans la liste d'un import (fiche 013)
insertBefore(R['import'].patterns[1].patterns, '#expression',
    ['#ldpy-import-prefix']);

// pname/bnode en position d'élément (appel, liste, parenthèses)
for (const key of ['function-arguments', 'list', 'round-braces']) {
    insertBefore(R[key].patterns, '#expression', ['#ldpy-bnode-args', '#ldpy-pname-args']);
}

// chaîne d'expressions SANS pname/bnode pour les subscripts et dict/set
R['expression-bare-nop'] = {
    comment: 'expression-bare sans pname/bnode : contextes où NAME:NAME est du Python valide',
    patterns: R['expression-bare'].patterns.filter(
        (p) => !['#ldpy-pname', '#ldpy-bnode'].includes(p.include)),
};
R['expression-base-nop'] = {
    patterns: R['expression-base'].patterns.map(
        (p) => (p.include === '#expression-bare' ? inc('#expression-bare-nop') : p)),
};
R['expression-nop'] = {
    patterns: R.expression.patterns.map(
        (p) => (p.include === '#expression-base' ? inc('#expression-base-nop') : p)),
};
for (const key of ['item-index', 'curly-braces']) {
    R[key].patterns = R[key].patterns.map(
        (p) => (p.include === '#expression' ? inc('#expression-nop') : p));
}

fs.writeFileSync(OUT, JSON.stringify(g, null, '\t') + '\n');
console.log(`écrit : ${OUT}`);
