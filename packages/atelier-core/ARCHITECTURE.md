# Architecture `atelier-core`

`atelier-core` est la source de verite technique partagee entre les ateliers Word et Excel.

## Ce qui vit ici

- `browser/` : runtime front partage, synchronise ensuite vers `apps/*/js/core/`
- `scripts/` : outillage partage de build, sync, validation et release
- `tests/shared/` : contrats de test reutilises par chaque app
- `runtime-contract.mjs` : ordre et conventions de chargement du runtime navigateur

## Ce qui reste specifique a chaque app

- `apps/*/data/` : contenu pedagogique et assets
- `apps/*/js/app-config.js` : noms globaux, extensions de fichiers, configuration storage
- quelques scripts wrappers dans `apps/*/scripts/` qui injectent seulement le contexte d'app

## Flux attendu

1. Modifier la logique partagee dans `packages/atelier-core`
2. Relancer `sync:app` de l'app concernee pour recopier runtime et HTML partages
3. Verifier avec les tests de contrat HTML/runtime et les tests applicatifs

## Features partagees documentees

- [QCM de fin d'exercice et rapport d'usabilite](./docs/FEATURE_QCM_USABILITE.md)
- [Architecture cible de la version connectee](./docs/ARCHITECTURE_VERSION_CONNECTEE.md)
- [Espace formateur (mode connecte)](./docs/FEATURE_ESPACE_FORMATEUR.md)

La note `ARCHITECTURE_VERSION_CONNECTEE.md` documente aussi l'etat reel de la V1 actuellement deployee :

- configuration editable `deployment-config.json`
- statut runtime local / serveur
- choix explicite du dossier local ou serveur
- gestion simple des divergences local / serveur

## Regles de maintenance

- Ne pas modifier directement `apps/*/js/core/*` sauf urgence ponctuelle, car ces fichiers sont regeneres
- Toute evolution du HTML partage doit rester compatible avec [DOM_CONTRACT.md](./browser/DOM_CONTRACT.md)
- Si un comportement diverge entre apps, privilegier `app-config.js` avant de dupliquer du code runtime
- Les scripts de release et de validation communs doivent etre testes dans `packages/atelier-core/tests/`

## Validation minimale

- `npm run core:test`
- `npm run excel:test`
- `npm run word:test`
- smoke test navigateur sur `apps/excel` et `apps/word`
