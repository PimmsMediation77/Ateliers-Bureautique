# Revue des exercices : bilan de la session du 2026-10-23

Ce document sert de point de départ à une vérification globale des exercices des ateliers (Word, Excel, PowerPoint). Il décrit les exercices déjà revus, les problèmes trouvés, les solutions retenues et la méthode de travail.

## 1. Exercices déjà revus (ne pas refaire)

### Word (`apps/word`)

| id | Titre | Problème | Correction |
|---|---|---|---|
| ex-010 | Raccourci clavier (m3, ex. 5) | Consignes Texte 1 à 4 rangées dans `criteria` | Déplacées dans `instructions`, critères réécrits en compétences |
| ex-011 | Aligner du texte (m3, ex. 6) | `instructions` tronquées (1 ligne), le reste dans `criteria` | 6 consignes remises dans `instructions`, critères réécrits |
| ex-020 | Paragraphes et oiseaux (m4, ex. 5) | `instructions` = « Consignes : » seul, consignes dans `criteria` | Idem |
| ex-012 | Mise en forme d'un courrier | Étapes incomplètes, police non mentionnée, critère = consigne | Étapes réécrites (justification, règle et repères, police Times New Roman, retraits), critère « reproduire à l'identique » |

### Excel (`apps/excel`) : `excel-ex-005` à `excel-ex-019`

| id | Titre | Fichier | Correction des étapes |
|---|---|---|---|
| 005 | Saisir des données | aucun (source sans fichier) | 5 séries reliées à leurs images via `exerciseTabs` |
| 006 | Tableau simple (ventes Béziers/Pézenas) | retiré (ne correspondait pas) | Tab / Entrée, fusion, bordures |
| 007 | Saisie et mise en couleur | retiré | Tab / Entrée, Alt+Entrée, sélection Ctrl, fusion, bordures |
| 008 | Formulaire de saisie | gardé ; annexe retirée | Étapes réécrites + fiche d'aide « Détails » (voir §3) |
| 009 | Sélection de colonnes | retiré | Ctrl+clic, couleur de fond |
| 010 | Sélection de lignes | retiré | Idem en lignes |
| 011 | Damier | retiré | Largeur/hauteur, pinceau, copier-coller |
| 012 | Insertion / suppression de cellules | gardé ; annexe retirée | Étapes écrites d'après le contenu réel du fichier |
| 013 | Cellules non contiguës | retiré | Ctrl+clic, cellule active |
| 014 | Planning (format et embellissement) | retiré | Fusion, bordures obliques, double contour, couleurs |
| 015 | Bordures et fonds (Oui/Non/Ballotage) | retiré | Pointillés, dégradés, hachures, pinceau |
| 016 | Format automatique | gardé | Dupliquer la feuille, Mettre sous forme de tableau |
| 017 | Écriture oblique | gardé | Orientation, bordures inclinées |
| 018 | Bordure et couleur de fond | gardé | Insérer ligne/colonne, pinceau |
| 019 | Styles personnalisés | gardé | Styles de cellules, style personnel |

PowerPoint : rien de revu.

### Seconde passe du 2026-10-23 (corrections en série)

Chaque exercice a été recoupé avec sa page source (récupérée par `curl`) et, pour Excel, avec le contenu du fichier de travail.

1. **Consignes rangées dans `criteria` / instructions tronquées (Word, 85 exercices).** Commits `2c1881e` (38 tronqués) et `15137df` (47 autres). Consignes reconstituées dans l'ordre de la source, critères réécrits en 2-3 compétences.
2. **Instructions génériques auto-générées.** 27 Word, 35 Excel (un commit par application). Fichiers corrigés au passage : `excel-ex-074` et `excel-ex-077` (fichier de travail et annexe inversés), `excel-ex-004` (annexe « dossards » sans rapport retirée), `excel-ex-026` (zip déclaré deux fois). `ex-006`, `ex-127`, `ex-128` : docx retiré (la source n'en fournit pas). `ex-006` passe en 2 onglets (`exerciseTabs`).
3. **Titres, descriptions et images (158 exercices, un commit par exercice).** Titre = H1 de la source sans « Exercice N - », description = objectif en une phrase. Images : l'affichage utilise en priorité `scrape.enonceImages` / `scrape.resultImages` ; ces listes, ainsi que `imageEnonce` / `imageResultat`, ont été reconstruites d'après l'ordre de la page (avant / après « Résultat attendu : », noms « solution »). Sur 36 exercices, l'énoncé et le résultat étaient inversés ou mal rangés.
4. **Fichiers manquants ajoutés depuis la source (un commit par exercice).** `ex-053` (carte), `ex-145` (xls), `ex-146` (docx + carnet xlsx), `ex-150` (xlsx), `ex-203` et `ex-205` (docx + zip), `ex-211` (zip).
5. **`levelLabel` aligné sur `level`.** Word : « 🟢 Débutant ⭐ »… ; Excel : `Debutant`, `Intermediaire`, `Avance`, `Expert` (`LEVEL_MAP` du script de scraping). Champ non affiché par l'application.

Points volontairement laissés : `ex-017` garde 6 consignes détaillées cohérentes avec l'image du résultat mais absentes de la page source ; `ex-018` et `ex-019` suivent la version actuelle de la page (valeurs différentes de l'ancien scrape).

## 2. Types de problèmes rencontrés et solution retenue

1. **Consignes rangées dans `criteria`.** Les « Critères de réussite » doivent décrire ce que l'exercice fait acquérir (ex. « Différencier la couleur de police et la couleur de surlignage »), jamais des consignes de mise en forme. Solution : déplacer les consignes dans `instructions`, écrire 2 à 3 critères-compétences.
2. **Instructions génériques auto-générées.** Phrases du type « Construisez la structure principale du classeur a partir de cet objectif: … », « Appliquez les outils Excel utiles… », « Comparez votre feuille avec l'image de resultat attendu… ». Solution : réécrire à partir de la page source, des images et du contenu du fichier de travail.
3. **Instructions tronquées.** Seule la 1re consigne est présente (ou « Consignes : »), le reste est ailleurs (`consignes`, `criteria`, `originalInstructions`). Solution : reconstituer la liste complète.
4. **Fichier à télécharger inadapté.** `docxUrl` / `downloadUrl` pointe vers le fichier d'un autre exercice (souvent même numéro dans un autre module). Vérification : ouvrir le xlsx (unzip, lire `xl/sharedStrings.xml` et la feuille), comparer à l'image et à la page source. Si la source ne fournit pas de fichier, mettre le lien à `null`. Les fichiers retirés ont été laissés sur disque (voir §6).
5. **Image de résultat déclarée comme énoncé.** `imageEnonce` = l'image du résultat, `imageResultat` = `null`, et `scrape.enonceImages` en doublon. Solution : `imageResultat` = l'image, `imageEnonce` = `null`, `scrape.enonceImages` = `[]`.
6. **Titres et descriptions.** Titres génériques (« Exercice 4 »), descriptions identiques au titre, fautes (« tabeau », « etinsertion », « celulles », « embelissement », « excel » en minuscule, « Ecriture »). Solution : titre = H1 de la page source, description = objectif en une phrase.
7. **Exercices en plusieurs séries / parties avec une image chacune.** Solution : `exerciseTabs` (un onglet par série, avec ses `instructions` et `resultImages`).
8. **Renvoi vers une page support.** Solution : fiche d'aide partagée `helpTopics` + `stepHelp` (bouton « Détails »), et étape raccourcie.
9. **Niveaux incohérents** (`level` vs `levelLabel`, ex. 34 exercices Excel de niveau 2 marqués « Debutant »). Signalé, **non traité**.

## 3. Évolutions techniques faites (code partagé `packages/atelier-core`)

- **Titres d'étape sur une ligne** : `.steps-list li > strong { display: contents; white-space: nowrap; }` dans les 3 `styles.css`.
- **Typographie française** : `frenchTypography()` dans `browser/view.js` ajoute à l'affichage une espace insécable avant « : » (si suivi d'un espace) et à l'intérieur des « ». URL, heures (15:30) et plages (A1:B5) ne sont pas touchées. Les libellés écrits en dur ont été corrigés (« Ex. : Alice », « Thème : »…).
- **Fiches d'aide « Détails »** : voir `packages/atelier-core/docs/FEATURE_FICHES_AIDE.md`. Racine `helpTopics` dans les données, `stepHelp: { "Libellé d'étape": "id-fiche" }` dans l'exercice. Les tests d'intégrité vérifient la fiche, son image et le libellé. Première fiche : `excel-formulaire`.

## 4. Règles de rédaction retenues

- **Format d'une étape** : `Libellé court : action.` Le libellé (≤ 4 mots, ≤ 30 caractères) est affiché en gras sur une ligne ; au-delà il n'est pas mis en gras.
- **Première étape** : sans fichier → « Nouveau classeur : ouvrez Excel et créez un classeur vierge. » ; avec fichier → « Fichier de travail : téléchargez le fichier de travail et ouvrez-le dans Excel. » (+ ce qu'il contient).
- **Fidélité à la source** : partir du sens de la page clic-formation (`pageUrl`), ne pas inventer de consignes. Ce qui est déduit de l'image ou du fichier doit être signalé à l'utilisateur.
- **Niveau de détail** : expliquer les techniques visées (Tab/Entrée, Ctrl+clic, fusion, pinceau, Format de cellule…) sans tout détailler cellule par cellule (retour de l'utilisateur sur 016-019).
- **Fichiers** : appliquer les règles d'`AGENTS.md` (pas de fichier si l'énoncé fait créer depuis zéro, pas de « ouvrez le fichier téléchargé » sans asset).
- **Champs** : `consignes` = texte source nettoyé ; `originalConsignes` / `originalInstructions` laissés tels quels ; `criteria` = 2 à 3 compétences.

## 5. Méthode et pièges

- **Source des données** : modifier uniquement `apps/<app>/data/exercises.structured.json`, puis dans l'app : `npm run build:data`, `npm run sync:app`, et `git checkout -- index.html app/index.html` (la synchro retire les `?v=` des scripts). Puis `npm test`.
- **Numérotation** : les ids sont globaux (`ex-010`, `excel-ex-007`), alors que les noms d'assets et l'affichage « ex-00N » suivent le numéro dans le module. Exemple : `ex-010` Word = assets `word-ex-005`.
- **Lire la page source** : la récupérer et noter mot pour mot titre, consignes, images et liens de téléchargement.
- **Inspecter un xlsx** : `unzip` dans un dossier temporaire, lire `xl/sharedStrings.xml`, `xl/workbook.xml` (feuilles) et `xl/worksheets/sheet1.xml` (cellules, `mergeCell`).
- **Commits** : `bash scripts/do-commit.sh "type(scope): description" fichiers…` depuis la racine (`npm run do:commit` échoue sous Git Bash). Le hook `commit-msg` n'accepte qu'une ligne.
- **Release** : `bash scripts/release-all.sh` fait `git add -A`. Mettre de côté les fichiers en cours (`git stash push -- <fichier>`) avant, et les restaurer après.

## 6. Pistes pour la vérification globale

**Comptage heuristique après la seconde passe du 2026-10-23.** Ce sont des signaux à vérifier, pas des erreurs certaines.

| Signal | Word (212) | Excel (236) | PowerPoint (6) |
|---|---|---|---|
| Instructions génériques auto-générées | 0 | 0 | 0 |
| Titre « Exercice N » | 0 | 0 | 0 |
| Description = titre | 0 | 0 | 0 |
| Image d'énoncé sans image de résultat (la source n'a pas de résultat) | 6 | 10 | 0 |
| Instructions sur une ligne (faux positifs : une seule consigne dans la source) | 4 | 0 | 0 |
| Critères identiques à une consigne | 0 | 0 | 0 |
| Sans critères de réussite | 90 | 189 | 6 |
| Avec fichier à télécharger (seuls ceux des exercices revus sont vérifiés) | 170 | 191 | 5 |

**Script de détection** (depuis la racine du dépôt) :

```bash
node -e '
for (const app of ["word","excel","powerpoint"]) {
  const ex = require("./apps/"+app+"/data/exercises.structured.json").exercises;
  const generic = ex.filter(e => (e.instructions||[]).some(s => /Construisez la structure principale|Appliquez les (outils|réglages)|Comparez votre (feuille|document|présentation) avec l.image de r/i.test(s)));
  console.log(app, generic.map(e => e.id).join(" "));
}'
```

**Fichiers retirés mais laissés sur disque** (`apps/excel/data/assets/excel/`). Ils appartiennent peut-être à d'autres exercices, à réaffecter ou à supprimer :

- `bases-saisir-des-donnees/excel-ex-002.xlsx` (TRIM.1, International, Messagerie, Express)
- `bases-saisir-des-donnees/excel-ex-003.xlsx` (carburant : « Quantité essence PLEIN », km)
- `bases-saisir-des-donnees/excel-ex-004-annexe-1.xlsx` (annuaire : NOM, DIRECTION, SITE, SALAIRE, 287 lignes)
- `bases-selection/excel-ex-001.xlsx` (piscine : PH, Chlore)
- `bases-selection/excel-ex-002.xlsx` (départements et préfectures)
- `bases-selection/excel-ex-003.zip` (5 classeurs de ventes par région : consolidation)
- `bases-selection/excel-ex-004-annexe-1.xlsx` (CA des vins par région, 145 lignes : TCD ?)
- `bases-selection/excel-ex-005.zip` (2 icônes pdf/print)
- `bases-mise-en-forme/excel-ex-001.xlsx` (fiche d'intervention)
- `bases-mise-en-forme/excel-ex-002.zip` (5 photos de plantes)

**Autres points ouverts**

- Vérifier le niveau (`level`) lui-même : seul le libellé a été aligné.
- Écrire des critères de réussite pour les exercices qui n'en ont pas (90 Word, 189 Excel, 6 PowerPoint).
- Vérifier un par un les fichiers à télécharger des exercices non revus (comparaison avec le fichier de la source).
- `ex-164`, `ex-171` (Word) : images non trouvées dans la page source, à contrôler à l'œil.
- Word : une « partie B » signalée par l'utilisateur n'a pas été identifiée (aucun exercice Word n'a d'onglets).
- Candidats aux fiches d'aide « Détails » : autres pages « support » de clic-formation référencées par les énoncés.
