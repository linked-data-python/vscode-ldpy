# Publier l'extension

Deux places de marché, un même `.vsix` : **Visual Studio Marketplace** (VS
Code) et **Open VSX** (VSCodium, Gitpod, Theia, Cursor…). Publier sur la
seconde coûte cinq minutes et double la portée ; ne pas le faire condamne les
utilisateurs de VSCodium à installer le `.vsix` à la main.

L'identité existe déjà : l'éditeur (*publisher*) `MaximeLefrancois` et
l'extension `MaximeLefrancois.linked-data-python` ont été publiés en 2022.
On reprend cette identité, on n'en crée pas une autre — l'`__metadata.id` du
`package.json` est celui de l'extension publiée.

## 0. Avant tout : ce qui n'est pas encore fait

Le dépôt `vscode-ldpy` **n'a jamais été poussé** sur son remote
`gitlab.emse.fr`. Le champ `repository` du `package.json` pointe vers une URL
qui n'existe pas encore ; le premier `git push -u origin main` revient à
Maxime. **Publier avant ce push** donne une page de marché dont les liens
« Repository » et « Issues » sont morts. Ordre recommandé : pousser, puis
publier.

## 1. Une fois : les jetons

### Visual Studio Marketplace

1. Un compte Microsoft/Entra, puis une organisation Azure DevOps
   (<https://dev.azure.com>) — n'importe laquelle, elle ne sert qu'à porter le
   jeton.
2. *User settings → Personal access tokens → New token*
   - **Organization : « All accessible organizations »** (le piège classique :
     un jeton limité à une organisation est refusé par `vsce` avec un 401
     illisible) ;
   - **Scopes → Custom defined → Marketplace → Manage** ;
   - durée : un an maximum, à renoter dans l'agenda.
3. Vérifier que le jeton parle bien à l'éditeur existant :

   ```text
   npx --yes @vscode/vsce login MaximeLefrancois
   ```

### Open VSX

1. Se connecter sur <https://open-vsx.org> avec GitHub.
2. Signer l'accord de publication (obligatoire, une fois).
3. *Settings → Access Tokens → Generate new token*.

Les deux jetons se rangent hors du dépôt. En local :

```text
export VSCE_PAT=…      # Visual Studio Marketplace
export OVSX_PAT=…      # Open VSX
```

## 2. À chaque version

```text
npm ci                       # dépendances exactes du lock
npm run generate             # regénère la grammaire depuis MagicPython
npm test                     # parité Python pur + golden îlots + non-dérive
npm run lint                 # tsc --noEmit
npm run package              # -> linked-data-python-<version>.vsix
```

`vscode:prepublish` relance `compile` puis `test` : une grammaire qui a dérivé
du générateur **fait échouer la publication**, ce qui est le but.

Vérifier le contenu de l'archive avant de l'envoyer — c'est le seul moment où
une erreur de `.vscodeignore` se voit :

```text
npx --yes @vscode/vsce ls
```

Doivent y être : `out/`, `syntaxes/ldpy.tmLanguage.json`,
`language-configuration.json`, `package.json`, `README.md`, `CHANGELOG.md`,
`LICENSE.md`, `ldpyIcon.png`, `icons/`, `media/`.
Ne doivent PAS y être : `src/`, `test/`, `demo/`, `syntaxes/upstream/`,
`syntaxes/generate.js`, `tsconfig.json`, ce fichier.

Installer le `.vsix` dans un VS Code propre et faire le tour à la main
(§ « Recette » ci-dessous), puis :

```text
npm run publish              # Marketplace (utilise $VSCE_PAT)
npm run publish:ovsx         # Open VSX  (utilise $OVSX_PAT)
```

`vsce publish minor` (ou `patch`, `major`) incrémente la version, crée le
commit de version et publie d'un coup. À n'utiliser que si le `CHANGELOG.md`
est déjà écrit : la page de marché l'affiche.

## 3. Recette manuelle avant publication

Ce que les tests automatiques ne voient pas — ils portent sur la grammaire,
pas sur VS Code. À dérouler sur `demo/demo-v2.ldpy` :

1. **Coloration** : ouvrir un fichier Python pur renommé en `.ldpy` ; il doit
   être coloré à l'identique. Ouvrir la démo ; les îlots doivent l'être aussi.
2. **Serveur** : la barre d'état affiche la version de `linked-data-python`.
   Une faute de frappe dans un îlot donne un diagnostic souligné.
3. **Complétion / hover / F12** sur du Python (délégué au backend).
4. **F5** sans `launch.json` : la session démarre, un point d'arrêt sur une
   ligne ordinaire s'arrête ; la **pile d'appels ne contient que le `.ldpy`**.
   Un pas au-delà de la dernière ligne **termine** le programme.
5. **Point d'arrêt dans un `g{ }` multiligne** : la pastille doit sauter
   d'elle-même sur la première ligne de l'îlot.
6. **Format Document** : le Python est reformaté, le corps des îlots ne bouge
   pas. Puis avec `linked-data-python` installé SANS l'extra `[format]` :
   VS Code doit dire qu'il n'y a pas de formateur, et non échouer.
7. **Interpréteur sans ldpy** : régler `ldpy.pythonPath` sur un python nu ;
   le message doit dire « paquet introuvable » et proposer la commande pip.
   Avec un `ldpy` ancien (sans `--probe`), le message doit dire « antérieur à
   cette extension », pas « introuvable ».

## 4. Versions

L'extension et le paquet Python avancent ensemble mais ne sont pas versionnés
ensemble. Règle : l'extension `0.2.x` exige `linked-data-python >= 0.2`
(c'est la version qui apporte `ldpy.debug --probe`, `ldpy/breakpointLines` et
`textDocument/formatting`). Toute nouvelle exigence côté Python doit :

1. arriver avec un repli lisible côté extension (message actionnable, pas une
   exception dans la console) ;
2. être écrite dans `README.md` § *Install* ;
3. faire monter le **minor** de l'extension.

## 5. Pré-versions et CI

`vsce publish --pre-release` publie un canal séparé que les utilisateurs
choisissent explicitement. Utile pour une grammaire remaniée.

Une publication depuis l'intégration continue n'est pas branchée. Si elle
l'était : un `job` déclenché sur tag, `VSCE_PAT`/`OVSX_PAT` en variables
masquées et protégées, et jamais sur une branche.

## Ce qui n'est pas bundlé, et pourquoi

L'extension n'est pas passée par un *bundler* (esbuild, webpack). `vsce` le
signale à chaque `package`. C'est assumé pour l'instant : le code de
l'extension tient en un fichier, tout le travail lourd se passe dans un
processus Python séparé, et la seule dépendance d'exécution est
`vscode-languageclient`. Le jour où l'archive ou le temps d'activation
deviennent un sujet, le bundling est une demi-journée — et il devra être
vérifié à la main, un bundle cassé ne se voyant qu'à l'exécution.
