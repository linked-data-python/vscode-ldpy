# Change Log

All notable changes to the "linked-data-python" extension will be documented in this file.

## [0.2.0] — en préparation

- **Formatage** : « Format Document » et le formatage à l'enregistrement,
  fournis par le serveur (`textDocument/formatting`) ; réglage
  `ldpy.lineLength` ; commande « Format All .ldpy Files in Workspace ».
  Nécessite `pip install "linked-data-python[format]"`.
- **Débogage : la correspondance est garantie** (fiche vscode/103). Le
  lanceur `-m ldpy.debug` n'apparaît plus dans la pile d'appels et n'attrape
  plus le pas qui suit la dernière ligne ; `step in` sur un îlot n'entre dans
  le runtime que si `justMyCode` est à `false` ; un point d'arrêt posé dans un
  îlot multiligne — qui ne pouvait pas se lier — est **déplacé** sur la
  première ligne de l'îlot au lieu de rester rouge et muet.
- **Surface revue** (fiche vscode/105) : huit commandes sous la catégorie
  `ldpy`, boutons ▷ et aperçu dans le titre de l'éditeur, menus contextuels,
  **aucun raccourci clavier par défaut** ; cinq réglages, tous avec une portée
  explicite ; `ldpy.pythonPath` a désormais pour défaut la chaîne vide
  (= interpréteur de l'extension Python), et `python` plutôt que `python3` en
  dernier recours sous Windows ; changer un réglage redémarre le serveur.
- **Barre d'état** : version de `linked-data-python` trouvée, interpréteur et
  chemin du paquet en infobulle, clic pour changer d'interpréteur. Les
  messages distinguent « paquet absent » de « paquet trop ancien ».
- `ldpy.showShadow` devient `ldpy.showTranspiled`.
- Documentation : `README.md` réécrit (c'est la page de marché),
  `PUBLISHING.md` et `DEVELOPMENT.md` remplacent `HOW_TO.md`.

- Coloration des constructions des fiches 013-020 : `s{ }` (SPARQL léger,
  accolades équilibrées, interpolations re-basculées en Python), `m{ }`,
  `+{ }`/`-{ }`, `@graph`/`@bindings` (avec `global`/`nonlocal`),
  `for @bindings [as b] in`, pnames dans les listes d'import — parité
  Python pur intacte, golden étendu.
- Coloration : grammaire GÉNÉRÉE depuis le MagicPython officiel de VS Code
  (`npm run generate`) — un fichier Python pur reçoit exactement les mêmes
  scopes qu'en `.py` (testé au caractère près par `npm test`) ; îlots ldpy
  (`@prefix`, IRIs, pnames, `g{}`, `f<>`, `e{}`/`e<>`, `?var`, `@lang`/`^^`)
  colorés uniquement là où ils sont réellement des îlots.
- Débogage natif : type de débogage « ldpy » (catégorie Debuggers), F5 et
  configurations dynamiques ; session debugpy sur `python -m ldpy.debug
  --run`, breakpoints posés dans le `.ldpy` liés directement (compilation en
  coordonnées source), plus de fantôme ni de traduction.
- Interpréteur : `ldpy.pythonPath` explicite, sinon l'interpréteur actif de
  l'extension Python, sinon `python3` ; contrôle `import ldpy` avec message
  actionnable.
- Client LSP v2 (diagnostics, complétion, hover, définition, semantic
  tokens), commandes Run / Show shadow / Restart server.

## [0.0.1] - 2022-04-29

- Initial release
