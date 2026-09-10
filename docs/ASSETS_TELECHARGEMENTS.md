# Assets de telechargement

## Objectif

Eviter les doublons dans le dossier utilisateur en imposant une nomenclature stable pour tous les fichiers telecharges depuis les ateliers.

## Convention de nommage

- Fichier principal d'exercice :
  - `word-ex-003.docx`
  - `excel-ex-005.xlsx`
  - `powerpoint-ex-002.pptx`
- Fichier annexe :
  - `word-ex-003-annexe-1.zip`
  - `word-ex-003-annexe-2.jpg`
  - `excel-ex-005-annexe-1.png`

Regles :

- Prefixe app obligatoire : `word`, `excel`, `powerpoint`
- Numero d'exercice toujours sur 3 chiffres : `ex-001`
- Pas de sous-dossier par type (`workfiles`, `images`, etc.)
- Le dossier de module porte le slug du module : `m03-saisir-du-texte`
- Le fichier principal ne porte pas le suffixe `annexe-*`
- Tous les fichiers supplementaires d'un meme exercice utilisent `annexe-1`, `annexe-2`, etc.

## Arborescence cible

```text
assets/
  word/
    m03-saisir-du-texte/
      word-ex-003.docx
      word-ex-003-annexe-1.zip
  excel/
    m05-formules/
      excel-ex-005.xlsx
      excel-ex-005-annexe-1.png
  powerpoint/
    bases-diaporamas/
      powerpoint-ex-001.pptx
```

## Inventaire

Le fichier maitre est :

- `reports/download-assets-inventory.json`

Une version tableur est generee pour travail manuel :

- `reports/download-assets-inventory.xlsx`
- `reports/sources-a-telecharger-par-exercice-v2.xlsx` pour le suivi manuel historique quand il est encore utile

Les telechargements source sont centralises dans un dossier mere dedie :

- `downloads-assets-source/`

Le script de recuperation y recree directement l'arborescence finale par app/module, sans le prefixe `assets/`.

Colonnes utiles :

- `app`
- `exerciseId`
- `moduleId`
- `moduleFolder`
- `slot`
- `sourceUrl`
- `suggestedFileName`
- `assetRelativePath`
- `driveModuleFolderId`
- `driveFileId`
- `driveViewUrl`
- `driveDownloadUrl`
- `assetUrl`

## Serving primary (GitHub Pages)

Les fichiers telechargeables par les usagers sont servis depuis GitHub Pages via des chemins locaux :

- URL cible : `data/assets/{app}/{module}/{fichier}`
- Fichiers versions dans `apps/*/data/assets/` (puis synchronises vers `apps/*/app/data/assets/`)

Commande de bascule / preparation :

```bash
npm run assets:github-primary
npm run assets:apply
npm run "do sync"
npm run assets:check-links
```

Google Drive reste un canal de preparation / sync optionnel, pas la source servie aux usagers.

## Workflow Drive public (preparation)

Si les fichiers sont ranges dans un Google Drive partage en lecture, l'inventaire peut etre enrichi automatiquement a partir du dossier racine Drive.

Exemple :

```bash
npm run assets:drive -- --root "https://drive.google.com/drive/folders/1jJmz7revwfH4mRXXlSTc4A85Y-i8HJQL"
```

Le script :

- retrouve les dossiers `word`, `excel`, `powerpoint`
- descend dans chaque dossier module attendu par l'inventaire
- cherche les fichiers par `suggestedFileName`
- renseigne `driveFileId`, `driveDownloadUrl` et `assetUrl`

Condition importante :

- le dossier Drive et ses sous-dossiers doivent etre accessibles en lecture par lien

## Workflow recommande

1. Generer ou regenerer l'inventaire.
2. Deposer / recuperer les fichiers source (`downloads-assets-source/` ou Drive).
3. Les nommer avec `suggestedFileName` et les ranger par module.
4. Lancer `npm run assets:github-primary` pour copier vers `apps/*/data/assets/` et poser les URLs `data/...`.
5. Appliquer l'inventaire (`assets:apply`) puis `npm run "do sync"`.
6. Verifier les liens (`npm run assets:check-links`) avant publication.

## Commandes

Generer l'inventaire :

```bash
npm run assets:inventory
```

Recuperer les fichiers source :

```bash
npm run assets:fetch
```

Bascule GitHub Pages (primary) :

```bash
npm run assets:github-primary
```

Appliquer l'inventaire aux donnees :

```bash
npm run assets:apply
```

Verifier les liens de telechargement :

```bash
npm run assets:check-links
```

Enrichir automatiquement depuis Google Drive public (preparation) :

```bash
npm run assets:drive -- --root "https://drive.google.com/drive/folders/..."
```

Puis regenerer les bundles de donnees :

```bash
npm run "do sync"
```
