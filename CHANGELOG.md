# Change Log

All notable changes to the "linked-data-python" extension will be documented in this file.

## [Non publié]

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
