# 108 — Le hover explique l'îlot sous le curseur, au plus petit élément

**Date** : 2026-09-03 · **Statut** : implémenté

## Contexte

Le hover répond nativement sur les îlots depuis la fiche 102 (`server.py:
_hover`), avec `**graph island**` suivi de l'extrait généré brut. Trois
manques :

1. **Rien ne dit ce qu'on regarde.** `**graph island**` nomme la sorte sans
   l'expliquer, et ne mène nulle part. La doc existe (neuf pages de
   `docs/reference/language/`) mais rien ne la relie au curseur.
2. **La traduction est brute.** Un `g{ }` de douze lignes devient une seule
   expression de 1 989 caractères — la même longueur qui a produit les pâtés
   rouges de la fiche 107. Illisible dans un panneau.
3. **La granularité est celle de l'îlot.** Survoler `sosa:Platform` au milieu
   d'un `g{ }` de quarante lignes rend la traduction des quarante lignes.

## Options

**Sur le protocole.** CodeLens et hover ont été pesés : le CodeLens est une
ligne cliquable insérée au-dessus du code, son contenu est un titre de
commande, pas un panneau riche. Un panneau au survol est
`textDocument/hover`, sans ambiguïté.

**Sur la « pagination ».** `Hover` rend un seul `MarkupContent`, ni onglets
ni navigation dans le protocole. Mais une maquette signature / filet /
description / filet / code est exactement ce qu'un seul bloc Markdown sait
faire, le `---` rendant le filet. Aucune extension du protocole n'est
nécessaire, et c'est ce que fait Pylance.

**Sur le grain.** Deux lectures possibles de « le plus petit élément » :

- *le plus petit nœud* — survoler le `ex:` de `ex:foo` donne un hover sur un
  fragment de nom préfixé, ou rien ;
- *le plus petit élément qui a une description* — on remonte au premier
  ancêtre décrit. Choisi : évite le trou sans réintroduire le pavé.

**Sur le transport du grain.** La `LanguageMap` est déjà fine pour les termes
écrits **hors** îlot (`x = ex:Thing` produit un segment `island:pname`), mais
un `g{ }` est un segment monolithique. Deux façons de descendre :

- *ajouter des segments imbriqués* dans la liste plate. Écartée : la liste
  est ordonnée et parcourue linéairement par quatre consommateurs —
  `to_src`/`to_gen` (qui rendent la PREMIÈRE correspondance),
  `snap_breakpoint_line`, `_mapping_points` (source map v3) et
  `semantic_tokens`. Imbriquer des spans y changerait trois réponses sur
  quatre, dont le placement des points d'arrêt (fiche vscode/103) ;
- *une liste `parts` portée par le segment d'îlot*, invisible du reste.
  Choisie.

## Choix

**Un hover en trois blocs séparés par des filets**, rendu par
`ldpy/lsp/hover.py` à partir d'une table `ldpy/lsp/islanddoc.py` :

1. une ligne de signature, à la manière de Pylance —
   `(term) ex:local -> URIRef`, `(expression) g{ ... } -> Graph` ;
2. deux ou trois phrases sur ce que fait cette sorte d'îlot, plus un lien
   vers la page readthedocs qui la documente (budget : aussi verbeuse que la
   docstring de `int()`, mais pas plus — le test borne à 460 caractères) ;
3. la traduction Python, formatée par `black`.

**Le grain est le plus petit élément décrit.** `g{ }`, `m{ }`, `+{ }` et
`-{ }` enregistrent leurs termes dans `Segment.parts` ; le hover prend le
plus petit qui couvre la position et retombe sur l'îlot pour la notation
elle-même, pour un `[ ]`, pour un `{python}` et pour `a`.

**`ldpy.hover.showTranslation`**, vrai par défaut, retire le troisième bloc
(fiche vscode/105). Il arrive par `initializationOptions` et reste vivant par
`workspace/didChangeConfiguration` : basculer un drapeau d'affichage ne
redémarre pas le serveur.

## Justification

**Un seul point d'instrumentation.** `_g_parse_triples` est partagé par les
quatre îlots composites, et tout terme y passe par `_g_node` (objets, sujets,
récursion dans `[ ]` et `( )`) ou par `_g_verb` (prédicats). Deux enveloppes
suffisent ; le parseur n'est pas retouché.

**Le classifieur est épinglé, pas cru.** `_term_kind` déduit la sorte des
premiers caractères consommés — les mêmes sur lesquels `_g_node` aiguille.
C'est un doublon, donc une dérive possible. `tests/test_hover_parts.py`
écrit chaque forme de terme **dans** un îlot et **hors** d'un îlot, et exige
que la sorte soit la même : hors îlot c'est le transpileur qui étiquette,
sans aide. Dix formes ainsi épinglées, plus sept qui n'existent qu'en îlot
(nombres, booléens, noms Turtle) épinglées à la main.

**Les liens ne pourrissent pas en silence.** `test_islanddoc.py` recalcule
les ancres de `docs/` avec le slugifieur de mkdocs et exige que chaque lien
de la table tombe sur une ancre existante. Le même fichier exige qu'une
sorte d'îlot ajoutée au transpileur ait sa description avant que la suite ne
redevienne verte.

**`black` échoue proprement.** Ce qu'on lui donne est un fragment : la tête
d'un `for @bindings in` n'est pas un module, et il refuse — à juste titre.
L'échec est silencieux et rend le texte tel quel. En contrepartie, `black`
normalise ce qu'il accepte (les guillemets d'abord) : le bloc est la
traduction *formatée*, pas un extrait au caractère près. `ldpy -t` reste le
lieu où lire le fichier généré.

## Conséquences

Le panneau de réglages de l'extension est en anglais (fiche 702).

## Ce qui reste ouvert

- `s{ }` n'a pas de `parts` : ses termes appartiennent au parseur SPARQL, qui
  est un autre chemin. Survoler dedans rend le hover de l'îlot.
- Survoler l'intérieur d'un `{python}` devrait être délégué à pylsp — c'est
  du Python — et rend aujourd'hui le hover de l'îlot.
- Retomber sur un îlot multi-lignes rend un bloc long (39 lignes mesurées sur
  un `+{ }` de test). Toujours mieux que le hover de l'îlot entier ; un
  plafond avec mention du nombre de lignes escamotées reste à faire si
  besoin.
- `a` (le raccourci Turtle de `rdf:type`) n'a pas de sorte d'îlot, donc pas
  de description propre.
