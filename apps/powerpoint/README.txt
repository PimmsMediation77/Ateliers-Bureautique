Atelier PowerPoint (MVC)

Ce fichier documente la source de travail dans `apps/powerpoint/`.
Le fichier `README-app.txt` documente, lui, la version distribuable destinee au poste utilisateur (copie en `app/README.txt` par `npm run sync:app`).

Application pedagogique PowerPoint issue du template Word.

Sources et adaptations des exercices :
- ressources initiales publiees sur Clic-formation : https://www.clic-formation.net/
- consignes, fichiers et apercus modifies, restructures ou completes pour cette application

Commandes principales depuis la racine :
- npm run powerpoint:test
- npm run powerpoint:build:data
- npm run powerpoint:sync:app

Source editable des exercices :
- data/exercises.structured.json

Flux standard :
- modifier data/exercises.structured.json
- npm run powerpoint:build:data -> regenere data/exercises.js pour le navigateur
- npm run powerpoint:sync:app -> recopie les donnees vers app/data

Scripts presents dans `scripts/` :
- flux courant : `build-data-js`, `sync-app`, `validate-encoding`, `repair-encoding`
- publication : `run-release-all`, `release-all.sh`, `update-release-artifacts`, `validate-release-*`, `standard-version-*`
- maintenance de contenu : `maintenance/scrape-exercises.mjs`, `maintenance/revise-exercises.mjs`, `maintenance/audit-exercises.mjs`
