# Synchronisation du depot

Genere le : 2026-07-15

## Etat synchronise

- Branche locale synchronisee sur `origin/main`
- Commit courant : `be4b8f9`
- Tag global courant : `bureautique-v1.21.0`

## Versions publiees

- Word : `word-v1.14.0`
- Excel : `excel-v1.7.0`
- PowerPoint : `powerpoint-v0.1.43`
- Monorepo : `bureautique-v1.21.0`

## Verifications executees

- `npm run runtime:validate`
- `npm run assets:verify-links`

Resultat :

- `2047` controles de liens d'assets
- `0` echec
- `0` desynchronisation entre `data/` et `app/data/`

Rapports associes :

- `reports/exercise-asset-links-report.json`
- `reports/exercise-asset-links-report.md`

## Sauvegarde de l'ancien etat local

Avant la synchronisation, l'etat local precedent a ete sauvegarde dans le stash :

- `stash@{0}` : `pre-sync-20260715-120133`

Commandes utiles :

- Voir le contenu : `git stash show -p stash@{0}`
- Restaurer sur une branche dediee :
  - `git switch -c reprise-pre-sync`
  - `git stash apply stash@{0}`

## Notes

- La synchronisation locale a ete faite par `git stash --include-untracked` puis `git merge --ff-only origin/main`.
- Cette methode permet d'aligner le depot sur l'etat publie sans perdre l'ancien contenu local.
