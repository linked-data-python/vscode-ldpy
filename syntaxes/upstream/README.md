# Grammaire amont (vendored)

`MagicPython.tmLanguage.json` est la copie EXACTE de la grammaire Python
embarquée par VS Code (extension intégrée `vscode.python`), qui est elle-même
générée depuis <https://github.com/MagicStack/MagicPython>.

- Copiée depuis : `/usr/share/code/resources/app/extensions/python/syntaxes/`
- VS Code 1.133.0 · extension intégrée `python` 10.0.0 · le 2026-08-27

Elle sert de **base** au générateur `syntaxes/generate.js` (qui produit
`syntaxes/ldpy.tmLanguage.json` en y injectant les îlots ldpy) et de
**référence** au test de parité `test/parity.js` : un fichier Python pur doit
recevoir exactement les mêmes scopes en `.ldpy` qu'en `.py`.

Pour rafraîchir : recopier le fichier depuis une installation VS Code récente,
mettre à jour les versions ci-dessus, puis `npm run generate && npm test`.
