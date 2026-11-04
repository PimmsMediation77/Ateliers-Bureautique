# Atelier PowerPoint

Application PowerPoint initialisee depuis le template Excel et alignee sur le socle partage.

## Source cible

- https://www.clic-formation.net/exercice-ppt-1.html
- https://www.clic-formation.net/exercice-ppt-2.html
- https://www.clic-formation.net/exercice-ppt-3.html
- https://www.clic-formation.net/exercice-ppt-5.html
- https://www.clic-formation.net/exercice-ppt-6.html
- https://www.clic-formation.net/exercice-ppt-7.html

## Commandes

- `npm run powerpoint:test` depuis la racine
- `npm test` depuis `apps/powerpoint`
- `npm run powerpoint:build:data` regenere `data/exercises.js` a partir de `data/exercises.structured.json`
- `npm run powerpoint:sync:app` copie l'application et les donnees vers `app/`

## Source de contenu

- La source editable des exercices PowerPoint est `data/exercises.structured.json`.
- Apres modification, lancer `npm run powerpoint:build:data` pour regenerer `data/exercises.js`.

## Actif / inactif

- Le pilotage de disponibilite se fait dans `data/availability-overrides.js`.
- Le mode d'emploi complet est dans [docs/GESTION_ACTIF_INACTIF.md](../../../docs/GESTION_ACTIF_INACTIF.md).
