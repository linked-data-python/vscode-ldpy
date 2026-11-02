# 102 — Extension VS Code

**Date** : 2026-11-02 · **Statut** : implémenté

## Existant

- `semantic_python/vscode-ldpy` : dépôt git, publié jadis sur le marketplace
  (`MaximeLefrancois.linked-data-python`) en version 0.0.1 (une grammaire
  TextMate et rien d'autre). Devenu `vscode-ldpy` de l'organisation, repris et
  refondu depuis.
- `semantic_python/ldpy-vsode-extension` : copie plus ancienne sans .git,
  archivée.

## Coloration syntaxique

Grammaire TextMate `source.ldpy` **générée** (`syntaxes/generate.js`) depuis
le MagicPython officiel de VS Code (vendored `syntaxes/upstream/`) : suffixe
`.python` conservé pour que les règles de thème propres à Python s'appliquent,
îlots `.ldpy` injectés uniquement à des positions invalides en Python pur
(voir l'en-tête du générateur pour la doctrine précise, alignée fiche 002 ;
pname/bnode volontairement ABSENTS des subscripts et dict/set — `d[i:j]`,
`{k:v}` restent du Python, le LSP raffine). `npm test` vérifie l'identité au
caractère près avec MagicPython sur les fixtures Python pur, le golden sur
les îlots, et la non-dérive grammaire/générateur.

Divergence assumée : `f<x>y` en contexte opérande est lu f-IRI (comme le
transpileur, R1/R3) — seul cas où un Python valide change de couleur ; déjà
signalé « à ne pas écrire » par la fiche 002.

La grammaire couvre aussi `s{ }` (coloration SPARQL légère à accolades
équilibrées), `m{ }` (contenu de graphe), `+{ }`/`-{ }` en tête de ligne,
`@graph`/`@bindings` (gardés contre les décorateurs, avec `global`/
`nonlocal`), `for @bindings [as b] in`, et les pnames dans les listes
d'import. Dans `g{ }`/`m{ }`/`s{ }`, `{expr}` re-bascule en Python
(`#expression`) ; dans `s{ }` c'est une heuristique TextMate (contenu sans
variable `?`/`$` ni mot-clé SPARQL sur un niveau d'accolades), là où le
transpileur dispose d'un oracle exact (transpiler puis compiler) — les cas
ambigus restent colorés en groupe, les semantic tokens du LSP raffinent.

Elle **compose** avec les semantic tokens LSP plutôt qu'elle n'est remplacée
par eux (fiche 101, LSP éteint) : quand le serveur tourne, les semantic
tokens colorent les îlots avec la précision du vrai parseur (préfixes
déclarés connus, positions exactes) par-dessus la base TextMate, qui reste
utile hors LSP (aperçus GitHub/GitLab, éditeurs sans serveur).

## Client LSP et débogage

Client LSP (`vscode-languageclient` → `python -m ldpy.lsp`, fiche 101),
activation sur `.ldpy`. Contribution `debuggers` (type `ldpy`, catégorie
Debuggers, configurations initiales/dynamiques → F5 fonctionne) ; le provider
traduit en session debugpy `python -m ldpy.debug --run` — grâce à la
compilation remappée (fiche ldpy/011), les breakpoints du .ldpy se lient sans
fantôme ni traduction. Interpréteur : `ldpy.pythonPath` explicite, sinon
celui de l'extension Python, sinon python3 — contrôle `import ldpy` avec
message actionnable.

## Cas de test visuels (fichier de démo)

`examples/terms.ldpy` + un fichier montrant chaque ambiguïté de la fiche 002
pour vérifier que le Python pur n'est jamais sur-coloré (`a<b>c`, `d[i:j]`,
`{k: v}`).

## L'intérieur de `s{ }` : la grammaire SPARQL du marketplace

Décision de Maxime du 2026-11-02 : `s{ }` est coloré par la grammaire SPARQL
de `stardog-union.stardog-rdf-grammars` 0.2.1 (Apache-2.0), posée sur sa
grammaire Turtle, toutes deux vendorisées dans `highlight-ldpy/vendor/` et
reprises par `src/textmate.js` (clés préfixées, `source.turtle` résolu sur
place). Restent à ldpy, en tête : la règle d'interpolation `{expr}`, les
f-IRI `f<…{expr}…>` et les groupes `{ … }` équilibrés qui reprennent le
tout. Les scopes sont ceux de la grammaire amont (`keyword.control.sparql`,
`constant.variable.sparql.turtle`…), golden régénéré. Les autres backends
(highlight.js, Prism, CodeMirror, Pygments) gardent leur lexique propre.

## Ce qui reste ouvert

- **tree-sitter** reste écarté pour l'instant comme alternative à TextMate
  (dépendance native, fiche 001) — à réévaluer si la coloration incrémentale
  de très gros fichiers devient un besoin.
- **Grammaire Turtle publiée pour les îlots Turtle** : possible comme pour
  SPARQL (ci-dessous), non faite — la grammaire légère des îlots Turtle porte
  des règles propres à ldpy (`{expr}`, `f<…>`, `_:{…}`, suffixes calculés)
  plus nombreuses qu'en SPARQL.
