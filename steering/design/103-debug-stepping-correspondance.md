# 103 — Débogage : correspondance systématique ldpy ↔ py pendant le stepping

**Date** : 2026-09-03 · **Statut** : implémenté — mesuré, tenu, testé

## L'invariant garanti

> **Chaque événement `stopped` du débogueur doit sélectionner une région du
> fichier `.ldpy`**, et cette région doit changer de façon cohérente avec le
> geste (step over avance d'une instruction source, step in entre, step out
> sort, continue s'arrête au prochain point d'arrêt) — jamais d'arrêt
> « invisible » sur du code généré sans antécédent source, jamais de
> sélection qui reste en place alors qu'un pas a eu lieu.

Le débogage passe exclusivement par la **compilation remappée**
(`ldpy.debug --run`, mode F5) : les code objects portent les coordonnées
`.ldpy`, le stepping suit donc nativement les lignes source. Le mode
« fantôme » (`ldpy.build` + debugpy sur le `.py`) n'est pas branché pour le
pas à pas dans l'extension et reste un outil d'inspection seul
(`ldpy: Show transpiled Python`) — documenté dans `docs/how-to/debug.md`.

## Le harnais de mesure

`ldpy/tests/dapclient.py` : un client DAP de ~300 lignes. Le serveur debugpy
(`--listen`) parle le Debug Adapter Protocol directement sur sa socket : ni
adaptateur ni VS Code à lancer. Le harnais reproduit exactement la ligne de
commande de l'extension (`-m debugpy --listen … -m ldpy.debug --run
f.ldpy`), envoie `initialize` / `attach` / `setBreakpoints` /
`configurationDone`, puis déroule des gestes et note (fichier, ligne,
colonne, profondeur de pile) à chaque `stopped`. Trois fils, aucune lecture
bloquante dans le fil principal : un test qui échoue échoue vite.

`ldpy/tests/test_debug_stepping.py` déroule huit programmes de référence :
une boucle avec `+{ }`, un îlot multiligne `g{ }`, un `for @bindings`, un
import de préfixes, une déclaration `global @graph`, une fonction, un îlot
`m{ }`, un `s{ }`.

## Ce que la correspondance tient, et pourquoi

Le prélude injecté (`import ldpy.runtime as _ldpy_; ...`) est rabattu sur la
ligne 1 et n'est jamais visité par un pas. Les émissions multi-instructions
sur une ligne source (import de préfixes, `@graph as`, `global @graph as`)
sont ramenées par le remappage à la même ligne source ; pydevd ne s'arrête
qu'au changement de ligne. Les lambdas de `e{ }` portent la position de
l'îlot : un point d'arrêt sur la ligne du `+{ … e{ } }` s'y lie et s'y
arrête.

**Les règles de pas sont décrites en Python.** `ldpy.debug.stepping_rules()`
rend la liste `rules` du DAP (`[{"path": glob, "include": false}]`), en deux
étages : le **lanceur** (`debug.py`, `__main__.py`) est masqué *toujours* —
c'est de la plomberie, elle n'appartient à personne ; le **reste du paquet**
ne l'est que sous `justMyCode` (le défaut, qui vaut alors ce qu'il devrait :
la demande explicite de voir le runtime, sans pour autant rendre la
plomberie). `PYDEVD_FILTERS` est écrasé par la requête DAP et
`LIBRARY_ROOTS` remplace les racines par défaut (rdflib deviendrait du code
utilisateur) — seul `rules` convient. `python -m ldpy.debug --probe` rend
`{package, version, python, rules}` ; l'extension appelle ce processus au
lieu de redécrire la politique, qui vit dans le paquet Python, donc sous la
suite pytest.

**Les points d'arrêt intenables sont déplacés, visiblement.**
`linemap.snap_breakpoint_line()` rabat une ligne intérieure d'îlot sur la
ligne de début de l'îlot ; le serveur LSP l'expose (`ldpy/breakpointLines`,
annoncée dans `capabilities.experimental`) ; l'extension écoute
`onDidChangeBreakpoints` et **déplace la pastille** dès que l'utilisateur la
pose. Le point d'arrêt fait alors ce qu'il montre.

## Les tests

`test_debug_stepping.py` (46 tests, marqués `slow`) affirme, pour les huit
programmes : chaque arrêt est dans le `.ldpy` ; deux arrêts consécutifs ne
sont jamais au même endroit ; la pile ne contient que des trames de
l'utilisateur ; la ligne rapportée existe et n'est pas vide. Plus les cas
particuliers (îlot multiligne, import de préfixes, `global @graph`, pas
entrant/sortant d'une fonction) et la politique `justMyCode` dans ses deux
états.

Un test **témoin** (`test_sans_regles_le_lanceur_fuit`) garde la mesure de
référence : sans `rules`, le lanceur fuit toujours (dans `ldpy/debug.py`, et
la pile d'appels montre ses trames). Il échouera si debugpy change d'avis —
et c'est alors la fiche qu'il faudra relire.

## Ce qui reste ouvert

La **colonne** rapportée par le DAP est toujours 1 : la région sélectionnée
est la ligne entière, jamais l'îlot lui-même. La map a les colonnes,
`compile()` ne les porte pas jusqu'au DAP. Amélioration possible, non
nécessaire à l'invariant.
