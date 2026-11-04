# Audit structurel du dépôt — 2026-11-04

Audit précédent : 2026-07-15 (`docs/AUDIT_RESTANT.md`, `docs/CONVENTIONS_REPO.md`).
Depuis : 383 commits, surtout `fix(excel)` (154), `chore(release)` (130) et `fix(word)` (32).

## Synthèse

| # | Constat | Gravité | Évolution depuis juillet |
|---|---------|---------|--------------------------|
| 1 | `apps/*/app/` toujours versionné (2 575 fichiers, ~147 Mo) | Haute | Inchangé |
| 2 | Assets pédagogiques dupliqués *à l'intérieur* de `data/` (≈1 170 copies) | Haute | Nouveau constat |
| 3 | Deux nomenclatures de dossiers de modules coexistent | Moyenne | Nouveau constat |
| 4 | ~470 assets non référencés par les exercices (~19 Mo) | Moyenne | Nouveau constat |
| 5 | Le runtime navigateur existe en 4 exemplaires | Moyenne | Inchangé (assumé) |
| 6 | La CI ne lance ni tests ni validations | Moyenne | Inchangé |
| 7 | 10 scripts racine orphelins (assets) | Basse | Nouveau constat |
| 8 | CSS et `index.html` divergents entre apps | Basse | Nouveau constat |
| 9 | Documentation éclatée sur 4 niveaux | Basse | S'est aggravé |
| 10 | Hygiène locale (objets git orphelins, test instable) | Basse | Nouveau constat |

Réponse à la question de suivi de l'audit précédent :
« Peut-on maintenant supprimer `apps/*/app/` du versionnement ? » → **Oui, techniquement rien ne s'y oppose** (voir §1), mais il vaut mieux traiter d'abord les §2 à §4, qui réduisent `data/` et donc le coût de `app/`.

## État vérifié le 2026-11-04

- `validate:app-sync` : OK pour les 3 ateliers (`app/` aligné sur les sources).
- `runtime:validate` : dérive détectée sur `home.js` et `progress.js`. Elle est due aux modifications non commitées en cours dans `packages/atelier-core/browser/` (travail sur l'accueil), pas à un défaut structurel.
- Tests : Word 256/256, Excel 278/278, core 6/6. PowerPoint : 1 échec au premier passage, 0 au second → test instable à identifier.
- Taille Git : pack de 64 Mo, plus 51 Mo d'objets non empaquetés.

## 1. `apps/*/app/` toujours versionné

| Atelier | Fichiers dans `app/` | Taille disque |
|---------|---------------------|---------------|
| Word | 1 067 | 73 Mo |
| Excel | 1 416 | 59 Mo |
| PowerPoint | 92 | 15 Mo |

Le workflow `.github/workflows/deploy.yml` se contente de copier `apps/*/app/` dans `dist/`. Or `app/` est entièrement reproductible par `build:data` + `sync:app`, scripts Node sans dépendance externe. La migration consisterait à :

1. ajouter dans le workflow une étape `npm run "do sync"` (ou un script `build:pages` équivalent) avant « Prepare Pages artifact » ;
2. ajouter `apps/*/app/` au `.gitignore` et faire `git rm -r --cached apps/*/app` ;
3. adapter `scripts/release-all.sh` et `validate-release-worktree.mjs`, qui supposent aujourd'hui que `app/` est commité ;
4. mettre à jour `CONVENTIONS_REPO.md`.

Gain : environ la moitié des fichiers suivis, et plus aucun risque de dérive entre source et publication. L'historique Git garde son poids actuel tant qu'il n'est pas réécrit (opération non recommandée).

## 2. Assets dupliqués à l'intérieur de `data/`

Fichiers au contenu identique (même hash Git) présents à plusieurs chemins dans `apps/*/data/assets/` :

| Atelier | Groupes de doublons | Copies en trop |
|---------|--------------------|----------------|
| Word | 419 | 573 |
| Excel | 508 | 581 |
| PowerPoint | 14 | 14 |

Deux causes principales :

- **paires `-image-*` / `-scrape-*`** dans un même dossier (ex. `word-ex-009-image-enonce.gif` = `word-ex-009-scrape-enonce-1.gif`) : héritage du flux de scraping ;
- **même fichier dans deux dossiers de module** (voir §3).

Chaque doublon est ensuite recopié dans `app/`. Une déduplication de `data/` réduit donc aussi `app/` d'autant.

## 3. Deux nomenclatures de dossiers de modules

Les dossiers d'assets mélangent un ancien et un nouveau schéma de nommage :

- Word : `m11-section-et-saut` … `m19-format-de-page` **et** `bases-11-section-et-saut` … `avance-19-…`. Les dossiers `m*` sont encore référencés 190 fois dans `exercises.js`.
- Excel : `avance-macro` **et** `avance-12-macro`, `bases-graphiques` **et** `bases-12-graphiques`, etc. On trouve aussi des dossiers `asca-*` (`asca-ul11-word` et `asca-02-ul11-word`).
- PowerPoint : `bases-diaporamas` / `bases-01-diaporamas`, `bases-animations` / `bases-03-animations-et-quiz`, `bases-navigation` / `bases-02-navigation-interactive`. Les anciens dossiers ne sont plus référencés qu'1 à 2 fois.

Le script `scripts/lib/module-folder.mjs` définit la convention cible (numérotée). Il reste à migrer les références restantes vers les dossiers numérotés, puis à supprimer les anciens dossiers.

## 4. Assets non référencés

Fichiers de `data/assets/` dont le chemin n'apparaît ni dans `exercises.js`, ni dans `exercises.structured.json`, ni dans `availability-overrides.js` :

| Atelier | Non référencés / total | Taille |
|---------|------------------------|--------|
| Word | 204 / 1 032 | 7,3 Mo |
| Excel | 261 / 1 384 | 7,9 Mo |
| PowerPoint | 8 / 60 | 4,0 Mo |

À confirmer avant suppression : certains fichiers peuvent être chargés par un chemin construit dynamiquement. Il faudrait un script `assets:unused` qui produise la liste dans `reports/` pour une revue manuelle.

## 5. Runtime navigateur en 4 exemplaires

`packages/atelier-core/browser/*.js` (18 fichiers) est recopié dans `apps/{word,excel,powerpoint}/js/core/`, puis à nouveau dans `apps/*/app/js/core/`. Hors travail en cours, les copies sont identiques et `runtime:validate` contrôle la dérive. Le modèle est assumé et fonctionne.

Si le §1 est réalisé, les copies `apps/*/js/core/` pourraient elles aussi devenir des artefacts générés, avec `sync:app` qui lirait directement le core.

## 6. CI sans garde-fou

`deploy.yml` lance seulement `assets:check-links`, puis publie. Aucun test, aucune validation `app-sync`, aucune validation runtime ni d'encodage. Un commit qui casse un atelier part donc en production si le hook local a été contourné.

Recommandation : ajouter avant le déploiement les étapes `npm run word:test`, `npm run excel:test`, `npm run powerpoint:test`, `npm run core:test`, `npm run runtime:validate` et `*:validate:app-sync` (tant que §1 n'est pas fait).

## 7. Scripts racine orphelins

10 scripts de `scripts/` ne sont appelés par aucun `package.json`, script shell ni workflow :

`apply-source-assets-inventory`, `audit-download-assets-anomalies`, `build-verified-download-anomalies`, `export-download-sources-xlsx`, `export-drive-missing-clic-formation-xlsx`, `generate-source-assets-inventory`, `prepare-source-assets-local-urls`, `rebuild-source-assets-mirror`, `stage-source-assets-into-apps`, `verify-exercise-asset-links`.

Ils correspondent aux chantiers ponctuels sur les assets (juillet–septembre). Pour chacun, il faut décider : l'exposer dans `package.json` (`assets:*`) s'il reste utile, ou le supprimer, puisqu'il reste disponible dans l'historique Git. `scripts/` passerait de 28 à environ 18 fichiers.

Les scripts des apps sont en revanche sains : ce sont des wrappers de 12 à 40 lignes qui délèguent à `atelier-core`.

## 8. CSS et `index.html` divergents

| Comparaison | Lignes de diff |
|-------------|----------------|
| `styles.css` Word ↔ Excel | 441 |
| `styles-redesign-v2.css` Word ↔ Excel | 1 664 |
| `index.html` Word ↔ Excel | 176 |
| `styles.css` Excel ↔ PowerPoint | 157 |
| `index.html` Excel ↔ PowerPoint | 164 |

Le JS est mutualisé, mais pas le CSS ni le squelette HTML (environ 3 100 lignes de CSS par atelier). `sync-app-html.mjs` existe déjà dans le core. Une feuille commune dans `atelier-core` avec des surcharges par atelier réduirait les corrections faites trois fois (cf. les commits `fix(ui)`). Les écarts Word ↔ Excel sur `styles-redesign-v2.css` sont à examiner en priorité : est-ce une divergence voulue ou une correction non reportée ?

## 9. Documentation éclatée

La documentation se répartit sur 4 niveaux :

- racine : `README.md`, `BACKLOG_GITHUB_ISSUES.md` (pas modifié depuis le 2026-06-24), `AGENTS.md` ;
- `docs/` : 7 fichiers, dont `Exercices Bureautique - todo.md` (une todo, donc pas de la doc durable au sens de `CONVENTIONS_REPO.md`) ;
- `packages/atelier-core/docs/` : 5 fiches `FEATURE_*` (+1 non commitée) ;
- `apps/*/docs/` : 16 fichiers, dont un second backlog (`BACKLOG_GITHUB_ISSUES_WORD.md`) et trois fichiers Word au nom accentué et avec des espaces.

Il y a aussi une règle doublée entre `AGENTS.md` et `.cursor/rules/interpretation-enonces.mdc`.

Recommandations :
- un seul backlog (ou des issues GitHub) ;
- les fiches `FEATURE_*` transverses dans `docs/features/` ;
- des noms de fichiers sans espaces ni accents ;
- un index dans `README.md`.

## 10. Hygiène

- `.git/objects` contient 15 fichiers `tmp_obj_*` orphelins et 616 objets « prune-packable » : lancer `git gc`.
- Dossiers non suivis mais présents : `apps/excel/logs/`, `apps/powerpoint/logs/`, `downloads-assets-source/` (5 Mo), `.agents/` (vide). `downloads-assets-source/` n'est ignoré que par `.git/info/exclude`, qui est local à ce poste : sur un autre clone, il apparaîtrait comme non suivi. Il faut l'ajouter à `.gitignore`, comme le demande la règle 6 de `CONVENTIONS_REPO.md`.
- Le script npm `"do sync"` contient un espace dans son nom, et `do:commit` / `release:all` utilisent une syntaxe `cmd.exe` : ils ne fonctionnent pas depuis un shell POSIX hors Windows.
- Les `assets/{word,excel,powerpoint}/.gitkeep` à la racine ne contiennent rien. Ce dossier est à documenter ou à supprimer.
- Le test PowerPoint instable (1 échec puis 0) est à isoler.

## Plan proposé

1. **Rapide (≤ ½ journée)** : `git gc` ; ajouter tests et validations dans `deploy.yml` (§6) ; trier les 10 scripts orphelins (§7) ; isoler le test instable.
2. **Assets (1–2 jours)** : script `assets:unused` + `assets:duplicates` → `reports/` ; migrer les références vers les dossiers numérotés (§3) ; supprimer doublons et non-référencés après revue (§2, §4).
3. **Publication (1 jour)** : générer `app/` en CI et le retirer du versionnement (§1).
4. **Plus tard** : CSS commun (§8), réorganisation de la documentation (§9).
