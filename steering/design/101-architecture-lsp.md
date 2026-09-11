# 101 — Architecture du language server

**Date** : 2026-09-03 · **Statut** : implémenté

## Contexte

Piste v1 (mars 2023) : fork de python-lsp-server (`ldpy-lsp-server`, 2 lignes
modifiées) — cul-de-sac de maintenance. Le sample Microsoft
`lsp-embedded-request-forwarding` (cloné en 2023) montre la bonne architecture.

## Décision : serveur mince par request-forwarding, appuyé sur le language map

```
VS Code ⇄ ldpy-lsp (dans le dépôt ldpy : ldpy/lsp/)
   didOpen/didChange .ldpy
      → transpile (rapide grâce au v2) → .py fantôme (.ldpy-build/) + LanguageMap
   requêtes LSP sur .ldpy (completion, hover, definition, references, diagnostics…)
      → positions traduites .ldpy→.py (map) → déléguées à un serveur Python réel
        (pylsp, lancé en sous-processus, non forké)
      → réponses traduites .py→.ldpy (map inverse)
   + couche native ldpy (traitée localement, sans délégation) :
      · diagnostics du transpileur (LdpySyntaxError, warnings fiche 004)
      · complétion des préfixes déclarés et des termes de vocabulaires connus
      · hover sur le plus petit élément décrit sous le curseur (fiche vscode/108)
```

Pas de pygls : le JSON-RPC/framing est écrit maison (`ldpy/lsp/rpc.py`,
~90 lignes) et sert des deux côtés, éditeur et backend. Justification : zéro
dépendance (cohérence fiche 008), pas de fragilité de version (pygls 1→2 a
cassé son API pendant le développement même), et la traduction opère sur les
structures LSP brutes (dicts), ce qui rend le forwarding trivial.

Fonctionne : diagnostics natifs + diagnostics Python du backend re-projetés
sur le .ldpy (ceux du prélude écartés), hover natif sur îlots / délégué
ailleurs, completion/definition/references/signatureHelp par forwarding avec
traduction aller-retour des positions et dé-shadowing des URIs. Dégradation
propre sans pylsp (mode natif seul). Vérifié par 32 tests dont 11 bout-en-bout
contre un vrai pylsp (`tests/test_lsp_*.py`).

`workspace/didChangeConfiguration` ne sert qu'à la couche native (un drapeau
d'affichage) et n'est pas retransmis au backend, qui reçoit sa propre
configuration au démarrage (fiche vscode/107).

Les semantic tokens LSP ne sont ni annoncés ni calculés par `ldpy-lsp` : ils
écraseraient les scopes TextMate de l'extension avec des tokens globaux sur
des régions entières, alors que la grammaire `source.ldpy`, engendrée par
`highlight-ldpy`, connaît leur structure interne. La coloration syntaxique
dans VS Code repose donc seulement sur TextMate, installé ou non avec le
serveur de langage (contrat vérifié dans `tests/test_lsp_server.py`). Les
snippets du hover sont des blocs Markdown balisés `ldpy` et `python`, sur
lesquels VS Code applique les grammaires correspondantes sans traitement
particulier.

## Débogage (DAP)

Pas d'adaptateur à écrire. `python -m ldpy.debug` = build + exécution du
fantôme sous debugpy ; `--breakpoints` publie la table de traduction pour
l'outillage. Les code objects portent les coordonnées `.ldpy`, donc les
traces du mode direct sont déjà compilées aux coordonnées source (vérifié par
`test_run_direct_traceback_points_to_ldpy`, qui contrôle fichier, ligne et
l'absence du fantôme `prog.py`).

## Vérification de version

Au démarrage réussi, l'extension interroge en arrière-plan l'API JSON de
PyPI, avec un délai de dix secondes et sans signaler les échecs réseau. Elle
compare la version publiée à celle de `ldpy.debug --probe` et, seulement si
elle est plus récente, propose le bouton `Update`, qui réutilise la
confirmation explicite et l'installation dans l'interpréteur déjà choisie par
`ldpy.installPackage`. Une même version ne notifie qu'une fois par session.
Vérifié par `test/journeys.js`.

## Conséquences / prérequis

- Prérequis : transpileur v2 rapide + LanguageMap + matérialisation (fiches 001–005).
- Le dossier `ldpy-lsp-server` (fork pylsp) est gelé ; à archiver.
- Dépendances LSP isolées dans un extra `pip install linked-data-python[lsp]`.

## Ce qui reste ouvert

Le hover natif ne porte pas le **label du vocabulaire** désigné par un
préfixe. Il demanderait de le charger — donc un accès réseau ou un cache
local, et une décision sur les deux. C'est le seul enrichissement du hover
qui demande autre chose que du texte.
