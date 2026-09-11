# 109 — Où le Python généré est matérialisé, et F5 sans launch.json

**Date** : 2026-09-03 · **Statut** : implémenté

## F5 n'ouvre plus launch.json

L'extension ne fournit pas d'adaptateur DAP : elle traduit la configuration
`ldpy` en une session `debugpy` équivalente, la démarre elle-même, puis
annule la session `ldpy`. L'API `DebugConfigurationProvider` distingue deux
annulations :

> Returning the value `undefined` prevents the debug session from starting.
> Returning the value `null` prevents the debug session from starting **and
> opens the underlying debug configuration instead**.

Le fournisseur rend `undefined` sur les deux chemins d'annulation —
délégation réussie, et environnement Python cassé (l'erreur a déjà été
montrée, un `launch.json` n'y répond pas). Un test de `journeys.js` interdit
`return null` dans le fournisseur.

## Où le `.py` est matérialisé

Le débogage ne matérialise rien : `Run` et `Debug` compilent le `.ldpy` en
coordonnées source et l'exécutent sur place (fiche ldpy/011). Seuls « Show
Transpiled Python » et `python -m ldpy.build` écrivent un fichier, à
l'emplacement décidé par `buildLocation()` :

| `ldpy.buildDirectory` | où le `.py` est écrit |
|---|---|
| relatif (défaut `.ldpy-build`) | dossier d'espace de travail du fichier, **arborescence reflétée** |
| absolu | tel quel |
| fichier hors espace de travail | à côté du fichier |

Le défaut met donc `.ldpy-build/` à la racine du projet, et le code généré ne
quitte pas l'espace de travail.

L'arborescence reflétée n'est pas un ornement : un répertoire de build unique
pour tout l'espace de travail ferait se rencontrer `a/m.ldpy` et `b/m.ldpy`
sur le même `m.py`. `ldpy.debug` reçoit donc une option `--root DIR` — le
`.py` va en `OUT/<chemin de la source relative à DIR>`. Une source hors de
la racine retombe sur son nom de base plutôt que de sortir du répertoire de
sortie par des `../`.

`config()` prend la ressource concernée : `buildDirectory` est de portée
`resource` (fiche vscode/105), donc dans un espace de travail multi-racines
la réponse dépend du fichier interrogé.

## Conséquences

- côté Python : `ldpy.debug.shadow_rel()`, testée seule, et un test qui vérifie
  que deux `m.ldpy` de dossiers différents ne s'écrasent pas ;
- côté extension : `buildLocation()` et deux vérifications dans `journeys.js` ;
- documentation : `docs/reference/cli.md` (`--root`) et une section « Where the
  generated Python lands » dans `docs/how-to/use-vscode.md`, qui rappelle que
  le débogage ne matérialise rien et que le répertoire s'ignore en `.gitignore`.
