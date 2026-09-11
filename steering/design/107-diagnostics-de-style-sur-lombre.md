# 107 — Les diagnostics de style ne traversent pas l'ombre

**Date** : 2026-09-03 · **Statut** : implémenté

## Contexte

Le serveur (fiche 101) entretient pour chaque `.ldpy` une ombre Python sur un
vrai pylsp ; pylsp charge tout greffon présent dans l'environnement, dont
**pycodestyle**. Or l'ombre est du code *généré* : un îlot multi-lignes y
devient une seule ligne longue. Reproduction pilotée (pycodestyle installé)
sur `test-syntax.ldpy` : **131 diagnostics**, dont `E501 line too long
(1989 > 79)` reprojeté sur la plage `.ldpy` L56–L67 — l'îlot `g1` entier
souligné. Un fichier Python pur en `.ldpy` reçoit de la même façon des
remontées (E501, E702…) que le `.py` d'à côté ne reçoit pas, Pylance
n'exécutant pas pycodestyle.

## Options

1. **Filtrer côté serveur** : `_on_backend_diags` écarte tout diagnostic
   dont la source est un linter de style. Simple, mais le backend calcule
   pour rien.
2. **Configurer le backend** : envoyer à pylsp, au démarrage, un
   `workspace/didChangeConfiguration` qui désactive ses greffons de style.
   Le calcul disparaît à la source, mais repose sur un backend qui honore
   la configuration.
3. **Resserrer la projection des plages** (rabattre une plage d'îlot sur sa
   première ligne) : traite le symptôme, pas le fond — le style du code
   généré ne concerne pas l'utilisateur, quelle que soit la plage.

## Choix

Les options 1 **et** 2, ceinture et bretelles : `SHADOW_SETTINGS`
(backend.py) désactive `autopep8`, `flake8`, `mccabe`, `pycodestyle`,
`pydocstyle`, `pylint`, `yapf` au démarrage ; `_on_backend_diags` filtre par
défense les mêmes sources, pour un backend qui ignorerait la configuration.
**pyflakes reste** : noms non définis, imports inutilisés — des faits du
programme, pas de sa forme générée, et leurs plages reviennent serrées
(vérifié : une seule remontée sur `test-syntax.ldpy`, bien placée).

## Justification

Le principe est celui du request-forwarding lui-même : l'ombre est un
artefact interne. Tout ce qui juge sa *forme* (longueur de ligne,
indentation de continuation, points-virgules — le transpileur en émet à
dessein) décrit le générateur, pas le programme de l'utilisateur. Un
avertissement de style sur du texte que l'utilisateur n'a pas écrit et ne
peut pas corriger est du bruit par construction.

## Conséquences

- `ldpy` 0.3.0 (commit `94f2d9f`) : `SHADOW_SETTINGS` + filtre, deux tests
  (`test_style_diagnostics_from_backend_are_dropped`,
  `test_backend_configuration_disables_style_plugins`), 1361 tests verts.
  `serverInfo` annonce désormais la version installée (le « 0.2.0 » en dur
  avait dérivé).
- Reproduction avant/après sur `test-syntax.ldpy`, pycodestyle installé :
  131 diagnostics → 1 (pyflakes, légitime).

## Ce qui reste ouvert

L'écart de coloration résiduel entre `.py` et `.ldpy` sur du Python pur vient
des **semantic tokens de Pylance**, que pylsp ne fournit pas — notre serveur
n'émet que ceux des îlots. C'est une limite du backend choisi, pas un défaut
de la grammaire ; à réévaluer si un backend à semantic tokens devient
disponible (fiche 102, couche déléguée).
