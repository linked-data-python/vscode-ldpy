# 105 — Surface de l'extension : réglages, commandes, raccourcis

**Date** : 2026-09-03 · **Statut** : implémenté

## Contexte

La surface d'une extension — ce qu'elle ajoute à la palette, aux menus, aux
réglages, au clavier — est le seul contrat qu'un utilisateur voit avant
d'avoir lu quoi que ce soit.

## Principe directeur

> **Ne rien ajouter que VS Code fournit déjà, et ne rien prendre à
> l'utilisateur qu'on ne lui rende pas.**

Trois corollaires, qui tranchent presque tous les cas ci-dessous : pas de
commande qui double un geste intégré ; pas de réglage qui double une option
d'éditeur ; pas de touche prise par défaut.

## Décisions

### 1. Commandes : catégorie `ldpy`, titres au verbe

VS Code affiche `category: title`. Écrire le préfixe dans le titre donne
« ldpy: ldpy: Run current file » dans certaines vues. Toutes les commandes
passent en `{"category": "ldpy", "title": "Run File"}`.

Huit commandes, et la raison d'exister de chacune :

| commande | pourquoi elle existe |
|---|---|
| `ldpy.run` | exécuter sans déboguer, dans un terminal |
| `ldpy.debug` | démarrer la session |
| `ldpy.showTranspiled` | **le geste signature d'un langage transpilé** : voir ce que c'est devenu |
| `ldpy.formatWorkspace` | formater TOUS les `.ldpy` — ce que « Format Document » ne sait pas faire |
| `ldpy.restartServer` | après une modification du paquet Python |
| `ldpy.showServerOutput` | ouvrir le journal ; **premier geste de tout rapport de bug** |
| `ldpy.selectInterpreter` | la panne n° 1 est « quel Python ? » |
| `ldpy.openDocumentation` | la documentation existe ; encore faut-il la trouver |

Une commande `ldpy.formatDocument` qui n'aurait fait qu'appeler
`editor.action.formatDocument` a été écartée : doubler un geste intégré
n'ajoute pas de découvrabilité, cela ajoute une entrée de palette qui se
comporte comme une autre. La capacité de formatage est annoncée par le
serveur — « Format Document » marche, et c'est tout ce qu'il faut.
`ldpy.formatWorkspace`, elle, fait quelque chose que rien d'autre ne fait :
elle reste.

### 2. Menus : le bouton ▷, pas une touche

- `editor/title/run` : `ldpy.run` et `ldpy.debug` apparaissent dans le
  **bouton ▷** du titre de l'éditeur, exactement là où l'extension Python met
  les siens. C'est la convention, et elle ne coûte aucun raccourci.
- `editor/title` : `ldpy.showTranspiled` a une **icône** ($(open-preview)),
  comme l'aperçu Markdown a la sienne — le geste est le même (voir l'autre
  face du document), la découverte doit l'être aussi.
- `editor/context` et `explorer/context` : les mêmes gestes au clic droit.
- `commandPalette` : les commandes liées au fichier sont masquées hors d'un
  `.ldpy` ; celles qui portent sur la session (serveur, interpréteur,
  documentation) restent toujours accessibles — on en a besoin **précisément**
  quand aucun `.ldpy` ne s'ouvre correctement.

### 3. Raccourcis clavier : AUCUN par défaut

Le clavier de VS Code est saturé, et un raccourci contribué par défaut est un
conflit pour quelqu'un — d'autant plus que nos utilisateurs sont des
développeurs Python, dont les doigts sont déjà pris par l'extension Python.
Les combinaisons encore libres sont libres parce qu'elles sont mauvaises
(accords à deux touches, plus lents que la palette).

Et les deux gestes vraiment fréquents **ont déjà leur touche** :

- **F5** débogue — gratuitement, parce que l'extension contribue un type de
  débogage `ldpy` ; `Ctrl+F5` exécute sans déboguer ;
- **Shift+Alt+F** formate, parce que le serveur annonce la capacité.

Il reste `showTranspiled`, qui n'a pas d'équivalent intégré — mais il a un
bouton, ce qui est mieux qu'une touche pour un geste occasionnel.

Le `README` documente donc comment se lier ce qu'on veut, avec la garde de
langage qui va bien :

```json
{ "key": "ctrl+alt+t", "command": "ldpy.showTranspiled",
  "when": "editorLangId == ldpy" }
```

Un test (`test/contributes.js`) échoue si un `keybindings` réapparaît : la
décision est gardée par la suite, pas seulement par cette fiche.

### 4. Réglages : six, tous avec une portée

| réglage | défaut | portée | pourquoi cette portée |
|---|---|---|---|
| `ldpy.pythonPath` | `""` | `machine-overridable` | un chemin absolu ne doit **pas** se synchroniser entre machines |
| `ldpy.backend` | `pylsp` | `window` | change le processus serveur |
| `ldpy.buildDirectory` | `.ldpy-build` | `resource` | par projet |
| `ldpy.lineLength` | `88` | `resource` | par projet, comme un `pyproject.toml` |
| `ldpy.trace.server` | `off` | `window` | le réglage LSP standard, sans lequel aucun rapport de bug n'est exploitable |
| `ldpy.hover.showTranslation` | `true` | `resource` | afficher ou non la traduction Python au bas du panneau de survol (fiche vscode/108) ; c'est une préférence de lecture, elle se règle par projet |

**Le défaut de `ldpy.pythonPath` est `""`, pas `"python3"`.** Un défaut non
vide rend « non réglé » indiscernable de « réglé à cette valeur » : le code
devait interroger les portées (`inspect()`) pour deviner l'intention. Avec un
défaut vide, l'intention est une valeur, la résolution est une ligne, et
`python3` — qui n'existe pas sous Windows — n'est plus le défaut affiché mais
le dernier recours, `python` sous Windows.

Réglages **volontairement absents**, parce qu'ils doubleraient l'éditeur :
`ldpy.format.enable` (VS Code sait ne pas formater), `ldpy.semanticTokens`
(`editor.semanticHighlighting.enabled` existe), `ldpy.formatOnSave`
(`"[ldpy]": {"editor.formatOnSave": true}` existe).

Changer `pythonPath`, `backend` ou `lineLength` **redémarre le serveur**
plutôt que d'afficher « rechargez la fenêtre » : le réglage prend effet quand
on le change. `ldpy.hover.showTranslation` n'a pas ce coût : elle bascule un
drapeau d'affichage, arrive par `initializationOptions` et reste vivante par
`synchronize` / `didChangeConfiguration`, sans redémarrage.

### 5. Une barre d'état

`ldpy: 0.2.0` à droite, visible seulement sur un `.ldpy`, avec l'interpréteur
et le chemin du paquet en infobulle, un fond d'avertissement et « non
installé » quand le paquet manque, et un clic qui ouvre le sélecteur
d'interpréteur. La panne racine la plus fréquente est « python3 global sans
paquet ldpy » ; une extension qui connaît la réponse à la question la plus
fréquente doit l'afficher, pas attendre qu'on la lui demande.

### 6. Le message d'erreur distingue deux pannes

« Paquet introuvable » quand le paquet est là mais trop ancien fait perdre une
demi-heure. L'extension essaie `-m ldpy.debug --probe`, et en cas d'échec
retente `import ldpy` pour savoir laquelle des deux pannes annoncer — avec, à
chaque fois, la commande `pip` exacte.

## Conséquences

- `test/contributes.js` (dans `npm test`) vérifie que les commandes
  contribuées et enregistrées coïncident, que les menus ne référencent que des
  commandes existantes, que tout réglage lu par le code est déclaré, que
  chacun a une portée et une description, et qu'aucun raccourci n'est
  contribué.
- La commande a été renommée `ldpy.showTranspiled` (depuis `ldpy.showShadow`).

## À reconsidérer

- Une vue arborescente des préfixes et graphes du fichier (`views`) : c'est le
  seul ajout de surface qui apporterait quelque chose que rien ne fait déjà.
  Demande un service côté serveur.
- Une *walkthrough* d'accueil (`contributes.walkthroughs`) : trois étapes —
  installer le paquet, ouvrir la démo, presser F5. C'est le format que VS Code
  prévoit pour ce que le README dit aujourd'hui.
