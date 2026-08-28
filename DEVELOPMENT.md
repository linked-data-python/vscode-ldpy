# Développer l'extension

```text
npm ci
npm run watch          # tsc en continu
```

Puis **F5** dans VS Code (« Run Extension ») : une fenêtre s'ouvre avec
l'extension chargée. `demo/demo-v2.ldpy` est le fichier de recette.

Le serveur de langage n'est PAS dans ce dépôt : c'est `python -m ldpy.lsp`,
du paquet Python. Pour travailler sur les deux à la fois, installer le paquet
en mode éditable dans l'interpréteur que désigne `ldpy.pythonPath`, et
utiliser la commande **ldpy: Restart language server** après chaque
modification côté Python.

## La grammaire est générée

`syntaxes/ldpy.tmLanguage.json` ne s'édite pas à la main. Elle est produite
par `syntaxes/generate.js` à partir du MagicPython officiel de VS Code,
vendoré dans `syntaxes/upstream/`. La doctrine — n'injecter les îlots que là
où le Python pur ne peut pas aller — est dans l'en-tête du générateur et dans
la fiche `DESIGN_CHOICES/vscode/102`.

```text
npm run generate       # regénère
npm test               # parité Python pur, golden îlots, non-dérive
```

`npm test` échoue si la grammaire committée n'est plus la sortie du
générateur : c'est ce qui garantit qu'on ne l'a pas retouchée à la main.

## Ce qui est testé où

| quoi | où |
|---|---|
| coloration (parité Python pur, golden îlots) | ici, `npm test` |
| serveur de langage, formateur, débogage | dans `ldpy/`, `pytest` |
| l'invariant de pas à pas | `ldpy/tests/test_debug_stepping.py`, qui pilote un vrai debugpy |

Les politiques partagées entre les deux dépôts vivent **du côté Python** et
sont lues par l'extension (`python -m ldpy.debug --probe`) : les règles de pas
du débogueur en sont l'exemple. Rien ne doit être redécrit ici.

## Publier

Voir `PUBLISHING.md`.
