# 102 — Extension VS Code

**Date** : 2026-09-03 · **Statut** : implémenté

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

## Ce qui reste ouvert

- **tree-sitter** reste écarté pour l'instant comme alternative à TextMate
  (dépendance native, fiche 001) — à réévaluer si la coloration incrémentale
  de très gros fichiers devient un besoin.
- **Grammaires Turtle/SPARQL existantes** (tmLanguage publiées) : possibles
  en principe pour l'intérieur de `s{ }` et des îlots Turtle, comme
  MagicPython l'est pour le Python. Non retenu à ce stade : il faudrait
  vendorer et adapter les scopes, et surtout y injecter les points de
  re-bascule `{expr}` — travail comparable à la grammaire légère actuelle,
  qui est testée par golden. À reconsidérer si la coloration SPARQL légère se
  révèle trop pauvre à l'usage (chemin : vendorer la grammaire SPARQL du
  marketplace, remplacer `#ldpy-sparql-content`, garder la règle
  d'interpolation en tête).
