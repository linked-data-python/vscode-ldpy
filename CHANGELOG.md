# Change Log

All notable changes to the "linked-data-python" extension will be documented in this file.

## [0.4.0] — 2026-09-01

- **A newer ldpy release is offered at startup.** Once the language server is
  ready, the extension checks PyPI in the background. Network failures and a
  ten-second timeout stay silent; a notification appears only when the
  published release is newer, and its `Update` button retains the existing
  explicit installation confirmation.
- **TextMate alone colors ldpy syntax.** Requires ldpy 0.5.1, whose language
  server no longer overrides the generated `highlight-ldpy` scopes with
  coarse semantic tokens.

## [0.3.0] — 2026-08-29

*From this entry on, the change log is in English, like everything a third
party reads (record pilotage/702). Earlier entries are left as they were
written: a dated record is not rewritten after the fact.*

- **A hover that explains the island under the cursor**, and answers on the
  smallest element it can name rather than on the whole block: a signature
  line, a short description with a link into the documentation, and the
  generated Python formatted by `black`. Requires ldpy 0.5.0.
- **New setting `ldpy.hover.showTranslation`** (on by default) to drop the
  generated Python and keep the explanation. It is applied live — changing
  it no longer restarts the language server.
- The settings panel is now in English.

## [0.2.1] — 2026-08-29

- **La barre d'état ne reste plus bloquée sur « non installé ».** Elle sondait
  une fois, à l'activation, et jamais plus : installer le paquet à la main,
  ou changer d'interpréteur, ne changeait rien à l'affichage. Trois manques,
  tous corrigés — un paquet absent est désormais un ÉTAT et non une exception
  levée (qui laissait le client jamais créé) ; la fenêtre qui reprend le focus
  déclenche une nouvelle sonde tant que quelque chose ne va pas, ce qui ferme
  la boucle du `pip install` fait dans un terminal ; et le changement
  d'interpréteur de l'extension Python est écouté, alors qu'il n'est pas un
  changement de NOS réglages.
- **Cliquer sur la barre d'état ouvre un menu** : installer ici (en disant
  dans quel interpréteur), choisir un autre interpréteur, resonder, voir le
  journal. Un clic ne décide plus tout seul de l'environnement qui reçoit le
  paquet — et après avoir choisi un interpréteur, le menu revient si le
  nouveau n'est pas mieux loti.
- **Installation et mise à jour depuis l'éditeur** (`ldpy: Install or Update…`),
  sur accord modal explicite, jamais en silence : l'interpréteur appartient à
  l'utilisateur. L'échec renvoie au journal plutôt que de disparaître.
- **« Show transpiled Python » fonctionne** : le chemin du fantôme revenait
  relatif et VS Code l'enracinait à `/` (`/.ldpy-build/x.py`). Corrigé côté
  paquet (chemin absolu) et côté extension (résolution défensive).
- Trois états distingués là où il n'y en avait qu'un : paquet absent, paquet
  trop ancien, interpréteur injoignable — trois problèmes, trois issues.


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
