# 106 — L'environnement Python est un état, pas une exception

**Date** : 2026-09-03 · **Statut** : implémenté

## Le défaut évité, et sa cause

Une première version sondait l'interpréteur **une fois**, à l'activation, et
traitait un paquet absent comme une **exception levée** : `startClient`
levait, le client n'était jamais créé, et plus rien ne redemandait jamais. La
barre d'état affichait « non installé » pour l'éternité — installer le
paquet à la main n'y changeait rien, choisir un autre interpréteur non plus.

Trois manques, tous de la même famille : **personne ne redemandait**.

1. Aucune nouvelle sonde après la première.
2. Le changement d'interpréteur de l'extension Python n'était pas écouté — ce
   n'est pas un changement de nos réglages, donc `onDidChangeConfiguration`
   ne le voit pas, et c'est pourtant la façon la plus courante de sortir de
   l'état « non installé ».
3. Un `pip install` fait dans un terminal, à côté, était par construction
   invisible.

## Choix

### Un état, quatre valeurs

`missing`, `outdated`, `noPython`, `ready`. Ce sont **trois problèmes avec
trois issues différentes** : installer, mettre à jour, changer
d'interpréteur. Proposer « Installer » quand l'interpréteur lui-même ne
démarre pas n'a aucun sens ; proposer « Installer » pour un paquet trop
ancien est le mauvais verbe.

### Trois façons de redemander

- le **focus de la fenêtre**, tant que quelque chose ne va pas. C'est ce qui
  ferme la boucle du `pip install` dans un terminal : on part, on installe, on
  revient — et l'extension a resondé. Une sonde coûte un sous-processus ; on
  ne la fait donc **pas** quand tout va bien ;
- le **changement d'interpréteur** de l'extension Python ;
- la commande explicite (`ldpy: Check the Python Package Again`).

### Le clic ouvre un choix, il ne décide pas

Un clic qui installerait directement déciderait **quel interpréteur reçoit
le paquet** — et se tromper là-dessus est précisément ce que la barre d'état
signale. Elle ouvre donc un menu : installer *ici* (en disant où), choisir un
autre interpréteur, resonder, voir le journal.

Et l'enchaînement compte : après avoir choisi un interpréteur, on resonde, et
**le menu revient** si le nouveau n'est pas mieux loti. « Choisir un
interpréteur puis y installer » est ainsi un geste, pas deux gestes
déconnectés.

### On installe sur accord explicite, jamais en silence

`ldpy.installPackage` demande **modalement** avant de lancer
`pip install -U "linked-data-python[lsp,debug,format]"`. L'interpréteur
appartient à l'utilisateur ; une extension qui y écrit sans demander est une
extension qu'on désinstalle. L'échec renvoie au journal plutôt que de
disparaître.

## Ce qui rend les parcours testables

La logique de décision est un module **pur** (`src/state.ts`) : aucun import
de `vscode`. Les états, le texte de la barre, ce que fait le clic, les entrées
du menu et le « faut-il resonder ? » sont des fonctions de ce que les sondes
ont répondu.

`test/journeys.js` rejoue alors un parcours comme une simple liste de
situations, et affirme à chaque étape ce que l'utilisateur **voit** et ce que
l'extension **fait ensuite**. Seize contrôles, dont le parcours *rien
d'installé → pip install à la main → prêt*.

Ce que ces tests ne peuvent pas atteindre — que l'écouteur de focus soit bien
abonné, que les identifiants de commande existent — est couvert autrement :
`test/contributes.js` pour les commandes, et trois assertions sur le texte
source pour les abonnements. C'est grossier, et cela attrape la seule
régression qui compte : un écouteur silencieusement supprimé.

Vérification complémentaire, hors tests : les quatre classifications sont
mesurées contre de **vrais interpréteurs** — un venv avec 0.2.0, un venv nu,
un venv avec l'ancienne 0.0.4, un chemin inexistant.

## Conséquences

- Publié en **0.2.1** sur les trois canaux (PyPI, Marketplace, Open VSX).
- `ldpy.setup`, `ldpy.refresh` et `ldpy.installPackage` s'ajoutent aux
  commandes ; `ldpy.restartServer` est un alias de `refresh`.
- La leçon, qui vaut au-delà de ce cas : **une panne qu'on ne peut pas
  réessayer n'est pas une panne, c'est une impasse.**
