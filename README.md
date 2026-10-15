# Ateliers Bureautique

Monorepo des ateliers bureautiques.

## Applications

- `apps/word` : atelier Word actuel, versionne independamment.
- `apps/excel` : atelier Excel aligne maintenant son flux de donnees sur Word.
- `apps/powerpoint` : atelier PowerPoint base sur le meme socle partage.
- `pages/` : accueil commun et version produit globale affichee a l'utilisateur.

## URLs publiees

- `/word/` : atelier Word.
- `/excel/` : atelier Excel.
- `/powerpoint/` : atelier PowerPoint.
- `/` : choix de l'atelier.
- `/releases/` : releases globales Ateliers Bureautique.

## Commandes

Depuis la racine :

- `npm run core:test`
- `npm run do:commit -- "fix(scope): description" [fichier...]`
- `npm run release`
- `npm run release:first`
- `npm run word:test`
- `npm run word:build:data`
- `npm run word:sync:app`
- `npm run word:release`
- `npm run word:release:all`
- `npm run excel:test`
- `npm run excel:build:data`
- `npm run excel:sync:app`
- `npm run powerpoint:test`
- `npm run powerpoint:build:data`
- `npm run powerpoint:sync:app`

Depuis `apps/word` ou `apps/excel`, les commandes locales restent disponibles (`npm test`, `npm run build:data`, etc.).
Depuis `apps/powerpoint`, les memes commandes locales sont aussi disponibles.

## Apercu local du site

- `npm run pages:preview` puis ouvrir http://localhost:4173/Ateliers-Bureautique/
- Reproduit l'artefact GitHub Pages (`pages/` + `apps/*/app`) dans `.pages-preview/` (ignore par git) et le sert avec `serve`.
- Affiche les versions distribuables : lancer `npm run "do sync"` avant si les exercices ont change.
- Port modifiable : `PORT=5000 npm run pages:preview`. Arret : Ctrl+C.

## Commit cible

- `npm run do:commit -- "fix(scope): description" [fichier...]`
- `npm run do:commit -- --dry-run "fix(scope): description" [fichier...]`
- Si tu passes des chemins de fichiers, seuls ces fichiers sont ajoutes puis commites.
- Si tu ne passes pas de fichiers, la commande commit uniquement ce qui est deja stage.
- Le message est valide par la meme regle que le hook `commit-msg`.
- La commande refuse de committer si d'autres fichiers deja `stage` sortent du perimetre demande.

## Architecture partagee

Le socle commun vit maintenant dans `packages/atelier-core` :

- `browser/` : runtime navigateur partage, synchronise vers `apps/*/js/core/`
- `scripts/` : sync, validation, release et helpers de build communs
- `tests/shared/` : contrats de test reutilises par Word et Excel
- `runtime-contract.mjs` : ordre de chargement des scripts partages

Chaque app garde seulement ce qui lui est propre :

- `apps/*/data/` pour les exercices et assets
- `apps/*/js/app-config.js` pour les noms globaux et la configuration de stockage
- quelques wrappers de scripts dans `apps/*/scripts/`

## Conventions de structure

- `docs/` contient la documentation durable du projet.
- `reports/` contient les inventaires, exports et rapports regenerables.
- `apps/*/app/` contient la version distribuable/publiee de chaque atelier.
- `apps/*/README.txt` documente la source de travail et le flux de developpement.
- `apps/*/app/README.txt` documente la version distribuable et son usage cote poste utilisateur.

Le dossier `apps/*/app/` ne doit pas etre modifie a la main sauf cas exceptionnel documente.
La source canonique reste `apps/*/{data,js,index.html,styles*.css,releases/,README.txt}` puis `npm run <app>:sync:app` recopie les elements publies vers `app/`.

La politique detaillee de versionnement et de generation est documentee dans `docs/CONVENTIONS_REPO.md`.

## Activation / desactivation

La V1 `actif / inactif` des modules et exercices est documentee dans :

- [docs/GESTION_ACTIF_INACTIF.md](/C:/Dev/Apps%20Pimms/ateliers-Bureautique/docs/GESTION_ACTIF_INACTIF.md)

Fichiers utilises :

- `apps/word/data/availability-overrides.js`
- `apps/excel/data/availability-overrides.js`
- `apps/powerpoint/data/availability-overrides.js`

## Versionnement

- Une version produit globale est portee par la racine du monorepo et affichee sur `pages/index.html`.
- Les versions `word-v...`, `excel-v...` et `powerpoint-v...` restent des versions techniques par module.
- `npm run release:all` publie les modules necessaires puis termine par la release globale `bureautique-v...`.

La note d'architecture detaillee est dans `packages/atelier-core/ARCHITECTURE.md`.

Pour la trajectoire `mode local + mode connecte via serveur local`, voir `packages/atelier-core/docs/ARCHITECTURE_VERSION_CONNECTEE.md`.

Etat actuel de la V1 connectee :

- fallback local conserve sans reseau local
- detection du serveur local par configuration `deployment-config.json`
- choix explicite `Dossier local` / `Dossier serveur` dans le parcours utilisateur
- priorite au dossier serveur quand il est disponible et autorise

## Flux recommande

1. Modifier la logique partagee dans `packages/atelier-core`
2. Relancer `npm run word:sync:app` ou `npm run excel:sync:app`
3. Verifier avec `npm run core:test`, puis `npm run word:test` et/ou `npm run excel:test`

Pour Word, le flux de donnees a ete simplifie :

- la source editable est `apps/word/data/exercises.structured.json`
- `npm run word:build:data` regenere `apps/word/data/exercises.js`
- les anciens scripts Word de scraping, revision et audit ont ete retires

Pour Excel, le flux standard suit maintenant la meme logique :

- la source editable est `apps/excel/data/exercises.structured.json`
- `npm run excel:build:data` regenere `apps/excel/data/exercises.js`
- `npm run excel:sync:app` copie les donnees et fichiers distribues vers `apps/excel/app`

Pour PowerPoint, le flux est similaire a Excel :

- la source editable est `apps/powerpoint/data/exercises.structured.json`
- `npm run powerpoint:build:data` regenere `apps/powerpoint/data/exercises.js`
- `npm run powerpoint:sync:app` copie les donnees et fichiers distribues vers `apps/powerpoint/app`

## Scripts par app

Chaque dossier `apps/*/scripts/` contient trois familles de scripts :

- scripts de flux courant : `build-data-js`, `sync-app`, `validate-encoding`, `repair-encoding`
- scripts de publication : `run-release-all`, `release-all.sh`, `update-release-artifacts`, `validate-release-*`, `standard-version-*`
- scripts de maintenance de contenu : `scripts/maintenance/*`

Etat par atelier :

- `apps/word/scripts/` : flux courant et publication seulement ; les anciens scripts de scraping/revision/audit ne sont plus conserves
- `apps/excel/scripts/` : flux courant, publication et scripts de maintenance (`scrape`, `revise`, `audit`)
- `apps/powerpoint/scripts/` : flux courant, publication et scripts de maintenance (`scrape`, `revise`, `audit`)

## Organisation cible

- `apps/*` : applications finales (`word`, `excel`, puis `powerpoint`, etc.).
- `packages/atelier-core` : scripts communs (`build-data`, `sync-app`, validation encodage) et runtime navigateur partagé (`model`, `storage`, `view`, `controller`) par les ateliers.
- `packages/*` : autres codes communs à extraire progressivement.
