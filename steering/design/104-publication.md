# 104 — Publier l'extension

**Date** : 2026-09-03 · **Statut** : chantier ouvert — procédure écrite et dépôts poussés, la publication elle-même reste à faire

## Contexte

`MaximeLefrancois.linked-data-python` existe sur le Visual Studio Marketplace
depuis 2022, en version 0.0.1 — une grammaire TextMate et rien d'autre. La
version 0.2.0 est un autre logiciel : serveur de langage, débogage,
formateur.

## Décisions

### 1. Deux places de marché

Visual Studio Marketplace **et** Open VSX. La seconde coûte cinq minutes (un
compte GitHub, un accord signé, un jeton) et sert VSCodium, Gitpod, Theia,
Cursor. Ne pas y publier condamne ces utilisateurs à installer un `.vsix` à la
main — pour un public de recherche, qui utilise beaucoup ces environnements,
c'est une barrière gratuite.

### 2. On reprend l'identité de 2022

Même éditeur, même identifiant d'extension, `__metadata.id` conservé : les
quelques personnes qui l'ont installée reçoivent une mise à jour, plutôt que
de découvrir un doublon. Le numéro repart de 0.2.0 pour s'aligner sur le
paquet Python.

### 3. `vscode:prepublish` lance les tests

`"vscode:prepublish": "npm run compile && npm test"` : une grammaire qui a
dérivé de son générateur, ou une commande contribuée sans être enregistrée,
**font échouer la publication**. C'est le seul endroit où l'on est certain que
quelqu'un regarde.

### 4. Une recette manuelle, écrite

Les tests portent sur la grammaire et sur la cohérence du `package.json` ;
aucun ne lance VS Code. Sept vérifications manuelles sont listées dans
`PUBLISHING.md` — dont trois qui n'existeraient pas sans les mesures de la
fiche 103 (pile d'appels sans le lanceur, pas terminal qui termine, pastille
qui saute) et deux sur les messages de panne (paquet absent / paquet trop
ancien).

### 5. Pas de *bundler*, et on le dit

`vsce` avertit à chaque `package`. Assumé : le code tient en un fichier, tout
le travail lourd se passe dans un processus Python, la seule dépendance
d'exécution est `vscode-languageclient` (326 fichiers, ~1 Mo). Le bundling est
une demi-journée le jour où l'archive ou l'activation deviennent un sujet — et
il faudra le vérifier à la main, un bundle cassé ne se voyant qu'à l'exécution.

### 6. Ce qui part, et ce qui ne part pas

`.vscodeignore` réécrit ; `vsce ls` donne exactement onze fichiers hors
`node_modules` : `out/extension.js`, la grammaire, la configuration de
langage, les icônes, la CSS, `README`, `CHANGELOG`, `LICENSE`, `package.json`.
Restent dehors : `src/`, `test/`, `demo/`, `syntaxes/upstream/` (le MagicPython
vendoré), les deux scripts du générateur, `PUBLISHING.md` et `DEVELOPMENT.md`.

### 7. Le README EST la page de marché

Un exemple qui montre le langage en dix lignes, un tableau de ce que
l'extension apporte, l'installation avec les extras, le paragraphe sur le
débogage, les réglages, **et une section « limites connues »** — la
sur-coloration des noms préfixés hors LSP, le cas `f<x>y`, le débogage en
mode direct seulement. Une page de marché qui ne dit pas ses limites les fait
découvrir en installation.

## Conséquences

- `PUBLISHING.md` (procédure, jetons, recette) et `DEVELOPMENT.md` (mise en
  route, grammaire générée, où est testé quoi) sont la documentation de
  référence de l'extension.
- Règle de compatibilité : l'extension `0.2.x` exige
  `linked-data-python >= 0.2` ; toute nouvelle exigence côté Python arrive
  avec un repli lisible, une ligne de README et un *minor*.
- Les deux dépôts (`vscode-ldpy`, `ldpy`) sont poussés sur
  `github.com/linked-data-python` et publics ; `repository` et `bugs` du
  `package.json` y pointent.

## Ce qui reste à faire (dans cet ordre)

1. Jetons Marketplace (portée « All accessible organizations », scope
   *Marketplace → Manage*) et Open VSX.
2. `npm ci && npm run generate && npm test && npm run package`, `vsce ls`,
   recette manuelle sur `demo/demo-v2.ldpy`.
3. `npm run publish` puis `npm run publish:ovsx`.
4. Publier `linked-data-python` sur PyPI — l'extension sans le paquet ne sert
   à rien, et le README envoie sur `pip install`.
