# design — index des décisions de conception de l'outillage éditeur

Un fichier par décision, numérotée dans la plage 100–199. Une fiche dit
**l'état d'aujourd'hui** : la décision en vigueur, les défauts non encore
résolus, les questions ouvertes — pas l'historique, qui est dans `git log` et
dans `../steps/`.

Ces fiches vivaient dans le dépôt de pilotage commun aux neuf dépôts de
l'espace de travail ; elles sont ici depuis le 2026-09-11, pour que les
décisions voyagent avec le code qu'elles décident. Le carnet d'avant cette
date est resté là-bas : il mêle l'extension aux autres projets et un document
daté ne se réécrit pas.

La fiche 101 décrit le serveur de langage, dont le **code vit dans le dépôt
`ldpy`** (`ldpy/lsp/`) et non ici. Elle accompagne malgré tout les huit
autres : c'est l'architecture dont elles dépendent, 102 et 107 la citent, et
séparer les neuf casserait la continuité des numéros — que les autres dépôts
utilisent pour s'y référer.

| # | Fiche | Décision en une ligne | Statut |
|---|---|---|---|
| 101 | [101-architecture-lsp.md](101-architecture-lsp.md) | Serveur mince par request-forwarding (JSON-RPC maison, sans pygls) | implémenté |
| 102 | [102-extension-vscode.md](102-extension-vscode.md) | Grammaire GÉNÉRÉE depuis MagicPython (parité Python pur testée) ; F5/debug natif via debugpy + fiche 011 | implémenté |
| 103 | [103-debug-stepping-correspondance.md](103-debug-stepping-correspondance.md) | Invariant de pas à pas : chaque arrêt sélectionne une région .ldpy, chaque geste la change | implémenté — mesuré, tenu, testé |
| 104 | [104-publication.md](104-publication.md) | Marketplace + Open VSX, identité de 2022 reprise, tests en `vscode:prepublish`, pousser le dépôt avant de publier | chantier ouvert — procédure écrite et dépôts poussés, la publication elle-même reste à faire |
| 105 | [105-surface-de-lextension.md](105-surface-de-lextension.md) | Huit commandes catégorisées, bouton ▷ plutôt qu'un raccourci, AUCUN raccourci par défaut, six réglages à portée explicite | implémenté |
| 106 | [106-etat-de-lenvironnement-python.md](106-etat-de-lenvironnement-python.md) | Un paquet absent est un ÉTAT et non une exception : quatre états, trois façons de resonder, un clic qui ouvre un choix ; parcours testés sur une logique pure | implémenté |
| 107 | [107-diagnostics-de-style-sur-lombre.md](107-diagnostics-de-style-sur-lombre.md) | Les « pâtés rouges » étaient pycodestyle jugeant l'ombre GÉNÉRÉE : greffons de style désactivés au démarrage + filtre de défense, pyflakes reste | implémenté |
| 108 | [108-hover-explique-lilot-sous-le-curseur.md](108-hover-explique-lilot-sous-le-curseur.md) | Le hover répond sur le plus petit élément décrit : signature, description liée à la doc, traduction formatée par black ; drapeau `ldpy.hover.showTranslation` | implémenté |
| 109 | [109-ou-le-python-genere-est-materialise.md](109-ou-le-python-genere-est-materialise.md) | `undefined` annule en silence, `null` ouvre launch.json — d'où le F5 fautif ; `ldpy.buildDirectory` relatif pend désormais de l'espace de travail, arborescence reflétée (`--root`) | implémenté |
