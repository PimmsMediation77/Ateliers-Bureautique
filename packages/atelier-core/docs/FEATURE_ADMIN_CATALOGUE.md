# Feature: Admin catalogue (CRUD modules et exercices)

## Objectif

Donner a l'equipe contenu un outil d'administration pour gerer le catalogue de chaque atelier (Word, Excel, PowerPoint) sans editer les fichiers JSON a la main :

- lister, creer, modifier, reordonner, activer / desactiver et supprimer des **modules** ;
- faire de meme pour les **exercices** d'un module ;
- gerer les **assets** associes (fichier de travail, images enonce / resultat, annexes) ;
- garantir la coherence du catalogue a chaque modification ;
- publier le resultat par le flux existant (`build:data` → `sync:app` → commit → GitHub Pages).

Dans ce document, **module** designe un theme de contenu (`m1`, `bases-prise-en-main`, ...) tel que defini dans `apps/<atelier>/data/exercises.structured.json`, et non l'atelier lui-meme.

## Contexte et dependances

### Etat actuel du produit

| Element | Etat |
|---------|------|
| Catalogue source `exercises.structured.json` par atelier | Livre, edite a la main |
| Masquage global `availability-overrides.js` | Livre, edite a la main |
| Contrat de test `exercise-integrity` | Livre, controle partiel |
| Flag `features.trainerAdmin` | Declare, desactive, non consomme |
| Espace formateur (usagers / progression) | Specifie, non livre |
| Interface d'administration du catalogue | Absente |

Volumes au moment de la redaction :

| Atelier | Modules | Exercices | Taille JSON |
|---------|---------|-----------|-------------|
| Word | 31 | 212 | ~465 Ko |
| Excel | 45 | 236 | ~940 Ko |
| PowerPoint | 3 | 6 | ~32 Ko |

### Positionnement par rapport a l'espace formateur

Les deux features sont distinctes et ne doivent pas etre fusionnees :

| | Admin catalogue (ce document) | [Espace formateur](./FEATURE_ESPACE_FORMATEUR.md) |
|---|---|---|
| Objet | Contenu pedagogique (modules, exercices, assets) | Usagers, progressions, QCM |
| Source de verite | Depot Git | Serveur local LAN |
| Portee d'un reglage | Global a l'atelier, pour tous les postes | Par usager |
| Utilisateur | Equipe contenu / mainteneur du depot | Formateur / mediateur sur site |
| Infrastructure | Aucune (outil local au poste de dev) | Serveur local a deployer |

L'espace formateur exclut explicitement un « CMS d'edition du catalogue d'exercices ». Cette feature couvre ce besoin par un outil separe.

Documents lies :

- [Gestion actif / inactif](../../../docs/GESTION_ACTIF_INACTIF.md) — format des overrides, repris tel quel par l'admin ;
- [Assets de telechargement](../../../docs/ASSETS_TELECHARGEMENTS.md) — nomenclature des fichiers ;
- [Conventions du repo](../../../docs/CONVENTIONS_REPO.md) — sources canoniques vs artefacts regeneres ;
- [AGENTS.md](../../../AGENTS.md) — regles d'interpretation des enonces (fichier a telecharger ou non).

## Constat technique

### Flux de donnees actuel

```text
apps/<atelier>/data/exercises.structured.json   (source editable)
apps/<atelier>/data/availability-overrides.js   (masquage global)
apps/<atelier>/data/assets/<atelier>/<dossier-module>/...
        │
        │ npm run <atelier>:build:data   (enveloppe le JSON dans window.<APP>_ATELIER_DATA)
        ▼
apps/<atelier>/data/exercises.js
        │
        │ npm run <atelier>:sync:app     (copie data/, js/, index.html, ... vers app/)
        ▼
apps/<atelier>/app/                      (artefact publie, versionne)
        │
        │ push sur main → .github/workflows/deploy.yml
        ▼
GitHub Pages (/word/, /excel/, /powerpoint/)
```

Le site est 100 % statique : toute modification de catalogue passe par un commit.

### Conventions d'identifiants observees

| Atelier | Id module | Id exercice |
|---------|-----------|-------------|
| Word | `m<N>` (`m1` ... `m31`) | `ex-<NNN>` |
| Excel | `<section>-<slug>` (`bases-prise-en-main`) | `excel-ex-<NNN>` |
| PowerPoint | `<section>-<slug>` (`bases-diaporamas`) | `powerpoint-ex-<NNN>` |

Sections : `bases` (1), `avance` (2), `complets` (3) pour Word ; `bases` (1), `avance` (2), `asca` (4), `complets` (5) pour Excel ; `bases` (1) pour PowerPoint.

### Champs denormalises

Plusieurs champs sont stockes alors qu'ils se deduisent d'autres donnees :

| Champ | Deductible de |
|-------|---------------|
| `module.exerciseCount` | nombre d'exercices ayant ce `moduleId` |
| `totals.modules`, `totals.exercises` | longueur des tableaux |
| `exercise.moduleName`, `moduleNameClean`, `moduleSlug`, `section` | module parent |
| `exercise.globalIndex` | ordre section → module → `num` |

Toute operation CRUD faite a la main doit aujourd'hui les mettre a jour une par une. Les oublis sont visibles dans les donnees actuelles :

- Word `m7` : `exerciseCount: 5` pour 4 exercices, numerotation `1, 3, 4, 5` (suppression de `ex-037`, commit `63b37f7`) ;
- Word `totals.exercises: 213` pour 212 exercices ;
- Excel `avance-controles-de-formulaire` : trou dans la numerotation ;
- Word : 2 assets locaux references mais absents du depot.

### Assets : deux conventions coexistent

- Dossiers de module : `m5-puces-et-numeros/` (convention `ASSETS_TELECHARGEMENTS.md`, dite « legacy » dans `scripts/lib/module-folder.mjs`) et `bases-03-saisir-du-texte/` (dite « canonique » dans le meme script) coexistent, parfois pour le **meme** module (ex. Word `m3` : fichier de travail sous `m3-saisir-du-texte/`, images sous `bases-03-saisir-du-texte/`).
- Noms de fichiers : le numero porte par le fichier est le `num` **dans le module**, pas l'id global. Exemple : Word `ex-027` (`num: 6`, module `m5`) → `word-ex-006.docx`.
- Nom propose a l'usager au telechargement : calcule par le runtime (`workfile.js`, `ex-<num>-<module>-<type>.<ext>`), independamment du nom stocke ; il depend aussi de `num`.

Consequence : reordonner les exercices d'un module change leur `num`, donc le nom des fichiers stockes **et** le nom propose a l'usager au telechargement.

### Niveaux heterogenes

Chaque exercice porte `level` (1 a 4) et `levelLabel` (texte). Constat :

- le runtime charge `level` mais ne l'affiche nulle part ; `levelLabel` n'est pas lu ;
- Word melange deux echelles : `🟢 Débutant ⭐` / `🟡 Intermédiaire ⭐⭐` / `🟠 Avancé ⭐⭐⭐` / `🔴 Expert ⭐⭐⭐⭐` et `Débutant` / `Moyen` / `Intermédiaire` / `Expert` ;
- Excel a des libelles contradictoires avec le chiffre (`level: 3` → `Debutant`, `level: 1` → `Avance`) et 67 libelles `null`.

### Types de champs heterogenes

Les champs image ne sont pas tous du meme type. Sur Word :

- `imageEnonce` : `string` (205), `null` (5), absent (1), `array` (1) ;
- `docxUrl` : `string` (162) ou `null` (50) ;
- `downloadUrl` : absent, `null` ou `string`.

Excel ajoute `exerciseTabs`, `etapes`, `extraImages`, `exerciseTextPreamble`. Le modele navigateur tolere ces variations ; l'admin doit les preserver sans les normaliser silencieusement.

### Risque bloquant : perte de progression

`AtelierModel.#sanitizeProgress()` ([model.js](../browser/model.js)) est appele par `importProgressObject()` et retire de la progression :

- `completedIds` ;
- `history` ;
- `feedback`

pour tout exercice absent de `exById`. Or `exById` exclut les exercices **desactives** (module ou exercice inactif via overrides), et pas seulement les exercices supprimes.

Scenario de perte :

1. un usager a termine `ex-040` ;
2. le module `m7` est desactive ;
3. l'usager ouvre l'atelier : `ex-040` est retire de sa progression en memoire ;
4. a la prochaine sauvegarde, le fichier `progression-word.json` est reecrit sans `ex-040` ;
5. le module est reactive : la progression est perdue.

Ce comportement existe deja avec les overrides manuels. Un outil CRUD rendrait ces operations frequentes : **la correction est un prerequis** (phase 0).

## Perimetre V1

### Inclus

- outil local lance depuis le depot (`npm run admin`), ouvert dans le navigateur du poste de dev ;
- selection de l'atelier (Word / Excel / PowerPoint) ;
- CRUD des modules : creation, edition (nom, section), reordonnancement, activation / desactivation, suppression ;
- CRUD des exercices d'un module : creation, edition des champs pedagogiques, reordonnancement, deplacement vers un autre module, activation / desactivation, suppression ;
- gestion des assets d'un exercice : ajout, remplacement, suppression, renommage automatique ;
- validation du catalogue avant chaque ecriture ;
- previsualisation de l'exercice avec le rendu de l'atelier ;
- publication locale : build, sync, tests, commit cible.

### Exclus (hors scope V1)

- edition depuis le site publie GitHub Pages ;
- edition multi-utilisateurs simultanee ;
- push Git automatique ;
- reglages par usager (relevent de l'espace formateur) ;
- edition des champs issus du scraping (`scrape`, `originalInstructions`, `originalConsignes`, `pageUrl`) ;
- re-scraping depuis clic-formation (scripts de maintenance existants) ;
- creation d'un nouvel atelier (nouvelle app) ;
- affichage du niveau aux apprenants (evolution ulterieure validee, voir Referentiel des niveaux) ;
- edition de `deployment-config.json`, `app-config.js`, styles, runtime.

## Principes produits

1. **Git reste la source de verite.** L'admin ecrit dans les memes fichiers qu'un humain ; un commit reste necessaire pour publier.
2. **Les identifiants sont immuables.** Un id de module ou d'exercice n'est jamais renomme ni reutilise : la progression des usagers y est rattachee.
3. **Desactiver plutot que supprimer.** La suppression par defaut est une desactivation reversible via overrides.
4. **Rien d'incoherent n'est ecrit.** Toute ecriture passe par la validation ; un catalogue invalide est refuse avec un message explicite.
5. **Diffs lisibles.** L'ordre des cles, l'indentation et l'encodage existants sont preserves.
6. **Pas de nouvelle infrastructure.** Aucun serveur a deployer, aucun jeton GitHub dans un navigateur.
7. **Le contenu suit les regles d'enonce.** Pas de fichier a telecharger impose quand l'enonce fait creer le document depuis zero.

## Architecture

### Option retenue : outil local Node lie au depot

```text
Poste mainteneur (depot clone)
  npm run admin
        │
        ▼
  packages/atelier-admin/server.mjs  (http://127.0.0.1:8790)
    ├─ sert l'UI admin (HTML/CSS/JS vanilla)
    ├─ API JSON /api/*
    ├─ lit / ecrit apps/<atelier>/data/exercises.structured.json
    ├─ lit / ecrit apps/<atelier>/data/availability-overrides.js
    ├─ ecrit apps/<atelier>/data/assets/<atelier>/...
    ├─ appelle packages/atelier-core/catalog (regles + validation)
    └─ lance build:data, sync:app, tests, do:commit
```

### Options ecartees

| Option | Raison de l'ecart |
|--------|-------------------|
| Admin integree au site publie, ecriture via l'API GitHub | Jeton GitHub expose cote navigateur ; `build:data` et `sync:app` ne tournent pas en CI ; tests non executes avant publication |
| CMS Git tiers (Decap, TinaCMS, ...) | Schema heterogene difficile a decrire ; invariants metier (ids, renommage d'assets, overrides) non exprimables ; dependance externe |
| Serveur local LAN de l'espace formateur | Infrastructure a deployer pour du contenu versionne ; melange contenu et donnees usagers |

Le module de regles `catalog` est concu pour etre reutilisable plus tard par le serveur de l'espace formateur (par exemple pour exposer la liste des modules a affecter par usager).

### Emplacement dans le monorepo

| Piece | Emplacement |
|-------|-------------|
| Regles metier, validation, calcul des champs derives | `packages/atelier-core/catalog/` (pur Node, sans I/O reseau) |
| Lecture / ecriture fichiers, renommage d'assets | `packages/atelier-core/catalog/fs-store.mjs` |
| Serveur HTTP local + UI | `packages/atelier-admin/` (nouveau package workspace) |
| Script de validation CLI | `packages/atelier-core/scripts/validate-catalog.mjs` |
| Commandes | `package.json` racine : `admin`, `<atelier>:validate:catalog`, `catalog:validate` |

`apps/*/app/` n'est jamais ecrit directement par l'admin : uniquement via `sync:app`.

## Modele de donnees

### Module (source)

Champs saisis :

```json
{
  "id": "bases-prise-en-main",
  "name": "Prise en main",
  "cleanName": "Prise en main",
  "section": "bases",
  "sectionOrder": 1,
  "orderInSection": 1
}
```

| Champ | Edition | Regle |
|-------|---------|-------|
| `id` | creation seulement | genere selon la convention de l'atelier, immuable |
| `name` | oui | libelle affiche, emoji autorise (Word) |
| `cleanName` | oui | libelle sans emoji ; propose automatiquement depuis `name` |
| `section` | oui | parmi les sections existantes de l'atelier |
| `sectionOrder` | non | derive de la section |
| `orderInSection` | via reordonnancement | entier continu a partir de 1 dans la section |
| `exerciseCount` | non | **recalcule automatiquement** (voir Champs derives) |

### Champs derives : conserves et recalcules

Decision : les champs derives (`exerciseCount`, `totals`, `globalIndex`, `moduleName`, `moduleNameClean`, `moduleSlug`, `section` de l'exercice) **restent dans le JSON** mais ne sont plus jamais saisis : ils sont recalcules par `catalog/deriveFields()` a chaque ecriture de l'admin et au `build:data`, et la CI echoue s'ils sont faux.

| Option | Benefice | Risque |
|--------|----------|--------|
| Retirer du JSON | Desynchronisation impossible, JSON plus leger | ~20 fichiers les lisent directement (runtime : tri par `globalIndex`, nom du theme ; tests ; scripts d'inventaire d'assets `scripts/lib/module-folder.mjs` ; maintenance Excel / PowerPoint) : adaptation de tous ces lecteurs, risque de regression |
| **Conserver + recalculer** (retenu) | Meme protection contre la desynchronisation, aucun lecteur a modifier | Redondance dans le JSON |

Le retrait pourra etre reconsidere une fois tous les lecteurs passes par une fonction partagee.

### Referentiel des niveaux

Un referentiel unique remplace la saisie libre de `levelLabel` :

| `level` | `levelLabel` (decide) |
|---------|------------------------|
| 1 | `🟢 Débutant ⭐` |
| 2 | `🟡 Intermédiaire ⭐⭐` |
| 3 | `🟠 Avancé ⭐⭐⭐` |
| 4 | `🔴 Expert ⭐⭐⭐⭐` |

Echelle reprise de la variante majoritaire de Word, avec emojis et etoiles, appliquee aux trois ateliers.

- l'admin propose `level` dans une liste deroulante ; `levelLabel` est derive du referentiel (champ derive, comme ci-dessus) ;
- le referentiel est partage par les trois ateliers (`catalog/levels.mjs`) ;
- la normalisation des libelles existants est faite en phase 0 : le chiffre `level` fait foi, `levelLabel` est reecrit depuis le referentiel. Les exercices dont le chiffre semble lui-meme faux (ex. Excel `level: 1` libelle `Avance`) sont listes pour revue manuelle avant reecriture ; les exercices `level: 0` (3 sur Word) recoivent un niveau ;
- l'affichage du niveau aux apprenants est **valide comme evolution ulterieure**, separee de l'admin V1 (le referentiel en est le prerequis).

### Exercice (source)

| Groupe | Champs | Edition |
|--------|--------|---------|
| Identite | `id` | creation seulement, immuable |
| Rattachement | `moduleId`, `num` | via deplacement / reordonnancement |
| Derives | `moduleName`, `moduleNameClean`, `moduleSlug`, `section`, `globalIndex` | non, recalcules |
| Affichage | `title`, `level` | oui (`level` via le referentiel) |
| Derive du niveau | `levelLabel` | non, derive du referentiel |
| Contenu (schema) | `description`, `preamble`, `instructions[]`, `criteria[]` | oui |
| Contenu Excel | `exerciseTabs[]`, `etapes`, `exerciseTextPreamble` | oui (editeur dedie) |
| Assets | `docxUrl`, `downloadUrl`, `downloadLabel`, `extraDownloadUrls[]`, `imageEnonce`, `imageResultat`, `imageEnonceCaption`, `imageResultatCaption`, `extraImages[]` | via gestion d'assets |
| Historique scraping | `pageUrl`, `scrape`, `originalInstructions`, `originalConsignes`, `consignes`, `paragraphMode` | lecture seule |

Les champs inconnus de l'admin sont conserves tels quels a l'ecriture.

### Overrides de disponibilite

Format inchange (voir [GESTION_ACTIF_INACTIF.md](../../../docs/GESTION_ACTIF_INACTIF.md)) :

```js
window.WORD_ATELIER_AVAILABILITY_OVERRIDES = {
  modules: {
    "m29": { active: false },
  },
  exercises: {
    "ex-001": { active: false },
  },
};
```

L'admin regenere ce fichier en conservant le bloc de commentaires d'exemple en tete. Une entree `active: true` est supprimee plutot qu'ecrite.

## Regles metier

### Identifiants

Pourquoi : la progression d'un apprenant est une liste d'ids d'exercices termines. Si `ex-037` est supprime puis qu'un nouvel exercice recoit `ex-037`, tous les apprenants ayant fait l'ancien verraient le nouveau comme deja termine.

Regle : un id d'exercice supprime n'est **jamais** reattribue. Mecanisme retenu : un compteur « dernier numero attribue » stocke dans le catalogue.

```json
{
  "idCounters": {
    "exercise": 213,
    "module": 31
  }
}
```

- Initialisation (phase 0) : maximum des ids existants (Word : 213 alors qu'il y a 212 exercices, `ex-037` ayant ete supprime).
- Nouvel id exercice : `<prefixe>-<compteur+1>` sur 3 chiffres, puis le compteur est incremente, meme si des exercices ont ete supprimes entre-temps.
- Nouvel id module :
  - Word : `m<compteur module+1>` ;
  - Excel / PowerPoint : `<section>-<slug(cleanName)>`, suffixe `-2`, `-3` si collision. La reutilisation d'un slug de module supprime est toleree : la progression n'est pas indexee par module, et les overrides du module supprime sont nettoyes a la suppression.

### Ordre et numerotation

- `orderInSection` : continu `1..n` dans chaque section apres toute operation.
- `num` : continu `1..n` dans chaque module apres toute operation.
- `globalIndex` : recalcule (tri section → module → `num`), continu `1..N`.
- Un changement de `num` declenche le renommage des assets concernes (voir Assets).

### Suppression d'un module

| Cas | Action proposee |
|-----|-----------------|
| Module avec exercices | Desactivation uniquement (override). Suppression definitive refusee. |
| Module vide | Suppression definitive possible apres confirmation ; overrides du module retires. |

### Suppression d'un exercice

- Par defaut : desactivation (override `exercises.<id>.active: false`).
- Suppression definitive : confirmation explicite listant les assets supprimes ; l'id n'est plus jamais attribue (compteur) ; renumerotation des exercices suivants du module et renommage de leurs assets.

### Deplacement d'un exercice vers un autre module

- `moduleId` change, l'exercice prend `num = n+1` dans le module cible ;
- assets deplaces dans le dossier du module cible et renommes ;
- module source renumerote.

### Activation / desactivation

- Ecrite exclusivement dans `availability-overrides.js` ; le catalogue n'est pas modifie.
- Un module desactive affiche ses exercices en grise dans l'admin.
- Avertissement si la desactivation masque un exercice reference ailleurs (ex. ancre de reprise).

### Regles d'enonce (reprises d'AGENTS.md)

- Pas de `docxUrl` / `downloadUrl` obligatoire : un exercice « creation depuis zero » n'a pas d'asset de travail.
- Si les consignes contiennent des formulations de telechargement obligatoire (« ouvrez le fichier telecharge », « decompressez », ...), un asset de travail est exige.
- Si l'asset est optionnel (« vous pouvez telecharger ... »), l'admin laisse l'asset vide et le signale.
- Les heuristiques sont celles du contrat `exercise-integrity` ; elles sont deplacees dans `catalog/` pour etre partagees.

## Assets

### Convention cible

```text
apps/<atelier>/data/assets/<atelier>/<dossier-module>/
  <atelier>-ex-<NNN>.<ext>                 fichier de travail principal
  <atelier>-ex-<NNN>-annexe-<k>.<ext>      fichiers supplementaires
  <atelier>-ex-<NNN>-image-enonce.<ext>
  <atelier>-ex-<NNN>-image-resultat.<ext>
  <atelier>-ex-<NNN>-scrape-*.<ext>        (historique, non cree par l'admin)
```

**Noms de fichiers — decide** : format `<atelier>-ex-<NNN>.<ext>` (ex. `word-ex-006.docx`), conforme a l'existant.

- `<NNN>` = `num` de l'exercice **dans son module**, sur 3 chiffres (convention actuelle, aucune migration).
- Contrepartie : un reordonnancement ou un deplacement renomme les fichiers ; l'admin le fait automatiquement.
- Alternative ecartee : `<NNN>` = numero de l'id global (`word-ex-027`), qui eviterait tout renommage mais imposerait de renommer d'un coup l'ensemble des assets existants.

**Dossier de module — decide** : convention canonique `<section>-<NN>-<slug>` (ex. `bases-03-saisir-du-texte`).

- `<NN>` = `orderInSection` sur 2 chiffres, `<slug>` = `cleanName` normalise (`slugify` de `scripts/lib/module-folder.mjs`) ;
- le dossier est renomme par l'admin si le module change de place dans sa section ;
- les dossiers legacy (`m3-saisir-du-texte`, documentes dans `ASSETS_TELECHARGEMENTS.md`) sont migres une fois en phase 0, et `ASSETS_TELECHARGEMENTS.md` est mis a jour.

### Operations

| Operation | Effet fichier | Effet catalogue |
|-----------|---------------|-----------------|
| Ajout | copie dans le dossier du module, nom normalise | champ correspondant renseigne |
| Remplacement | ecrasement du fichier, meme nom | inchange |
| Suppression | fichier supprime si plus reference ailleurs | champ mis a `null` |
| Renumerotation | `git mv` des fichiers `<atelier>-ex-<ancien>*` vers `<nouveau>*` | chemins mis a jour |
| Reordonnancement de module | `git mv` du dossier si le `<NN>` change | chemins mis a jour |
| Renommage de module | aucun deplacement de dossier en V1 | inchange |

Le renommage passe par un fichier temporaire pour eviter les collisions lors d'une permutation (`003 → 004` et `004 → 003`).

### Formats acceptes

- travail : `.docx`, `.doc`, `.xlsx`, `.xls`, `.pptx`, `.ppt`, `.zip`, `.pdf`, `.txt`, `.csv` ;
- images : `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp` ;
- taille maximale par fichier : 15 Mo (GitHub Pages), avertissement au-dela de 5 Mo.

## Validation

Un module `catalog/validate.mjs` produit une liste de diagnostics `{ level, code, path, message }`. Il est utilise par l'admin (avant chaque ecriture) et par la CLI / les tests.

| Code | Niveau | Regle |
|------|--------|-------|
| `MODULE_ID_DUPLICATE` | erreur | id module unique |
| `MODULE_SECTION_UNKNOWN` | erreur | section connue de l'atelier |
| `MODULE_ORDER_GAP` | erreur | `orderInSection` continu par section |
| `MODULE_EMPTY` | avertissement | module sans exercice (masque par le runtime) |
| `EXERCISE_ID_DUPLICATE` | erreur | id exercice unique |
| `ID_COUNTER_BEHIND` | erreur | `idCounters` inferieur au plus grand id existant |
| `LEVEL_UNKNOWN` | erreur | `level` absent du referentiel des niveaux |
| `DERIVED_FIELD_STALE` | erreur | champ derive different de sa valeur recalculee |
| `EXERCISE_ORPHAN` | erreur | `moduleId` existant |
| `EXERCISE_NUM_GAP` | erreur | `num` continu `1..n` par module |
| `EXERCISE_TITLE_MISSING` | erreur | `title` non vide |
| `EXERCISE_CONTENT_MISSING` | erreur | au moins description, preamble, instructions ou criteria |
| `ASSET_MISSING` | erreur | chemin local reference existant sur disque |
| `ASSET_REQUIRED_BY_TEXT` | erreur | consigne de telechargement obligatoire sans asset |
| `ASSET_OPTIONAL_LINKED` | avertissement | telechargement optionnel avec asset lie |
| `ASSET_NAME_NONSTANDARD` | avertissement | nom hors convention |
| `ASSET_UNREFERENCED` | info | fichier present dans `assets/` mais reference nulle part |
| `OVERRIDE_UNKNOWN_ID` | avertissement | override sur un id inexistant |
| `ENCODING_SUSPECT` | erreur | mojibake detecte (`encoding-guard`) |

Les erreurs bloquent l'ecriture ; les avertissements sont affiches et n'empechent pas l'enregistrement.

Une fois la phase 0 terminee, `catalog:validate` est ajoute a `npm test` de chaque atelier et au workflow `deploy.yml` (avant `Setup Pages`).

## API locale

HTTP JSON, ecoute uniquement sur `127.0.0.1`. Toutes les routes d'ecriture renvoient `422` avec la liste des diagnostics si la validation echoue, `409` si le fichier a change sur disque depuis la lecture (comparaison d'empreinte).

| Methode | Chemin | Role |
|---------|--------|------|
| `GET` | `/api/apps` | Ateliers disponibles, sections, conventions d'id |
| `GET` | `/api/apps/:app/catalog` | Modules + exercices + overrides + empreinte |
| `GET` | `/api/apps/:app/diagnostics` | Validation complete |
| `POST` | `/api/apps/:app/modules` | Creation module |
| `PATCH` | `/api/apps/:app/modules/:id` | Edition nom / section |
| `PUT` | `/api/apps/:app/modules/order` | Reordonnancement (`{ section, ids[] }`) |
| `PUT` | `/api/apps/:app/modules/:id/active` | Activation / desactivation (`{ active }`) |
| `DELETE` | `/api/apps/:app/modules/:id` | Suppression definitive (module vide uniquement) |
| `POST` | `/api/apps/:app/modules/:id/exercises` | Creation exercice |
| `GET` | `/api/apps/:app/exercises/:id` | Detail exercice (tous champs) |
| `PATCH` | `/api/apps/:app/exercises/:id` | Edition champs editables |
| `PUT` | `/api/apps/:app/modules/:id/exercises/order` | Reordonnancement (`{ ids[] }`) |
| `POST` | `/api/apps/:app/exercises/:id/move` | Deplacement (`{ targetModuleId }`) |
| `PUT` | `/api/apps/:app/exercises/:id/active` | Activation / desactivation |
| `DELETE` | `/api/apps/:app/exercises/:id` | Suppression definitive |
| `POST` | `/api/apps/:app/exercises/:id/assets/:slot` | Upload (`slot` : `work`, `annexe`, `image-enonce`, `image-resultat`) |
| `DELETE` | `/api/apps/:app/exercises/:id/assets/:slot` | Retrait d'un asset |
| `GET` | `/api/apps/:app/preview/:exerciseId` | Apercu : redirige vers `apps/<atelier>/index.html` sur l'exercice (catalogue deja regenere a l'enregistrement) |
| `GET` | `/api/git/status` | Fichiers modifies par l'admin |
| `POST` | `/api/apps/:app/publish` | Build + sync + tests + commit cible |

Chaque reponse d'ecriture renvoie le catalogue mis a jour, la nouvelle empreinte et la liste des fichiers touches.

## UI admin V1

### 1. Accueil

- choix de l'atelier ;
- compteurs : modules, exercices, inactifs ;
- etat de validation (erreurs / avertissements) ;
- fichiers modifies non commites.

### 2. Liste des modules

- regroupement par section, glisser-deposer pour l'ordre ;
- colonnes : nom, id, nombre d'exercices, statut actif / inactif ;
- actions : ouvrir, activer / desactiver, supprimer (si vide), creer un module.

### 3. Fiche module

- edition nom / nom propre / section ;
- liste des exercices avec glisser-deposer, statut, niveau, icones d'assets presents ;
- actions par exercice : editer, deplacer, activer / desactiver, supprimer ;
- creer un exercice.

### 4. Edition d'exercice

- champs d'identite et d'affichage ;
- editeurs de listes pour `instructions` et `criteria` (ajout, suppression, reordonnancement) ;
- editeur d'onglets pour `exerciseTabs` (Excel) ;
- zone assets : un emplacement par slot, glisser-deposer, apercu image ;
- panneau lecture seule « Source scraping » (`pageUrl`, `originalInstructions`) ;
- diagnostics en direct pour l'exercice ;
- bouton « Previsualiser » (rendu atelier dans un nouvel onglet).

### Apercu

Le bouton « Apercu » ouvre l'exercice dans l'atelier, tel que l'apprenant le verra, avant toute publication. Il n'y a aucune etape manuelle : l'admin relance `build:data` automatiquement apres chaque enregistrement, l'apercu est donc toujours a jour. Il ne s'agit ni d'un zoom ni d'une vue des etapes.

### 5. Publication

- recapitulatif des fichiers modifies (catalogue, overrides, assets, `exercises.js`, `app/`) ;
- execution sequentielle avec journal : `build:data` → `sync:app` → `validate:app-sync` → tests de l'atelier ;
- message de commit propose, valide par `validate-commit-message` ;
- commit via `npm run do:commit -- "<message>" <fichiers>` ;
- rappel : le push reste manuel et declenche le deploiement.

## Publication

Message de commit propose selon l'operation (types autorises par `validate-release-commits.mjs`) :

| Operation | Exemple |
|-----------|---------|
| Ajout de contenu | `feat(word): ajouter le module « Signets »` |
| Correction de contenu | `fix(excel): corriger les consignes de excel-ex-041` |
| Desactivation | `chore(powerpoint): desactiver le module bases-animations` |

Le commit n'inclut que les fichiers touches par l'admin depuis le dernier commit ; les autres modifications du working tree sont signalees et laissees de cote, conformement a `do:commit`.

## Securite

- serveur lie a `127.0.0.1` uniquement, port configurable ;
- ecritures limitees a `apps/<atelier>/data/` (verification de chemin apres resolution, refus de `..`) ;
- noms de fichiers d'upload ignores : le nom est toujours genere ;
- verification d'extension et de signature (magic bytes) des fichiers uploades ;
- jeton aleatoire genere au lancement, passe dans l'URL ouverte, exige sur les routes d'ecriture (protection contre les requetes d'autres pages du navigateur) ;
- aucune commande shell construite a partir d'une saisie utilisateur ; arguments passes en tableau a `spawn`.

## Feuille de route d'implementation

### Phase 0 — Fiabiliser le catalogue (prerequis)

- corriger `#sanitizeProgress` : conserver dans le fichier les ids inconnus du catalogue charge, les ignorer seulement pour l'affichage et les compteurs ;
- creer `packages/atelier-core/catalog/` avec `deriveFields()` et `validateCatalog()` ;
- creer `deriveFields()` : recalcul de `exerciseCount`, `totals`, `globalIndex`, `moduleName*`, `section`, `levelLabel`, appele par `build-data-js.mjs` ;
- initialiser `idCounters` dans les trois catalogues ;
- adopter le referentiel des niveaux et normaliser `level` / `levelLabel` existants ;
- migrer les dossiers d'assets legacy vers la convention canonique et mettre a jour `ASSETS_TELECHARGEMENTS.md` ;
- extraire les heuristiques de telechargement du contrat `exercise-integrity` vers `catalog/` ;
- corriger les donnees : Word `m7`, `totals` Word, Excel `avance-controles-de-formulaire`, 2 assets Word manquants ;
- ajouter `catalog:validate` aux tests et a la CI.

Critere de done : `catalog:validate` passe sans erreur sur les trois ateliers ; desactiver puis reactiver un module ne fait perdre aucune progression (test dedie).

### Phase 1 — Admin en lecture + modules (edition, ordre, activation)

- package `atelier-admin`, serveur local, UI accueil + liste modules + fiche module (lecture des exercices) ;
- ecriture JSON preservant format et ordre des cles ;
- edition nom / section, reordonnancement, activation / desactivation ;
- diagnostics affiches.

Critere de done : renommer et reordonner un module produit un diff limite aux lignes concernees ; l'atelier recharge affiche le nouvel ordre.

### Phase 2 — Creation / suppression de modules

- generation d'id selon convention et compteur `idCounters` ;
- suppression definitive d'un module vide, desactivation sinon.

Critere de done : un module cree apparait dans l'atelier des qu'il contient un exercice ; un module supprime ne peut pas etre recree avec le meme id.

### Phase 3 — CRUD exercices + assets

- creation / edition / reordonnancement / deplacement / suppression ;
- gestion des assets par slot, renommage automatique a la renumerotation ;
- apercu (build automatique apres enregistrement) ;
- editeur `exerciseTabs` pour Excel.

Critere de done : creer un exercice avec fichier de travail et images, le deplacer dans un autre module, puis le supprimer, sans aucun diagnostic d'erreur ni fichier orphelin.

### Phase 4 — Publication assistee

- enchainement build / sync / tests ;
- commit cible avec message valide.

Critere de done : une modification faite dans l'admin est publiee sur GitHub Pages apres un simple `git push`.

### Ordre et dependances

```text
Phase 0 ──▶ Phase 1 ──▶ Phase 2
                  └──▶ Phase 3 ──▶ Phase 4
```

La phase 0 a de la valeur seule (fiabilite des donnees, correction de perte de progression) et peut etre livree independamment.

## Tests

| Niveau | Contenu |
|--------|---------|
| Unitaires `catalog/` | derivation des champs, generation d'id, renumerotation, chaque code de validation |
| Contrat partage | `catalog:validate` execute par `npm test` de chaque atelier |
| Modele | progression conservee apres desactivation / reactivation (nouveau cas dans `model.contract.mjs`) |
| `fs-store` | ecriture idempotente (lire puis ecrire sans modification = diff vide), renommage avec permutation, refus de chemin hors `data/` |
| API | scenarios CRUD sur une copie temporaire d'un catalogue (fixtures PowerPoint, le plus petit) |
| Bout en bout | creation module + exercice + asset, build, sync, chargement du modele genere |

## Risques et mitigations

| Risque | Mitigation |
|--------|------------|
| Perte de progression des usagers | Correction `#sanitizeProgress` en phase 0 ; ids immuables ; desactivation par defaut |
| Diffs JSON illisibles | Serialisation preservant ordre des cles et indentation ; test d'idempotence |
| Assets desynchronises apres reordonnancement | Renommage automatique ; validation `ASSET_MISSING` / `ASSET_UNREFERENCED` |
| Nom de telechargement change apres reordonnancement (base sur `num`) | Avertissement dans l'admin avant reordonnancement d'un module deja utilise ; verifier que la reprise du fichier de travail reste indexee par id d'exercice |
| Reattribution d'un id supprime | Compteur `idCounters` ; validation `ID_COUNTER_BEHIND` |
| Ecrasement entre admin et edition manuelle | Empreinte de fichier, reponse `409` et rechargement |
| Mojibake (emojis, accents) | Ecriture UTF-8 sans BOM, passage par `encoding-guard` |
| Derive vers un CMS generaliste | Perimetre limite aux modules / exercices / assets ; config et runtime exclus |
| `app/` modifie a la main par erreur | L'admin n'ecrit jamais dans `app/` ; `validate:app-sync` dans la publication |
| Fichiers volumineux dans le depot | Limite 15 Mo, avertissement a 5 Mo |

## Decisions et questions ouvertes

| # | Sujet | Statut | Decision / recommandation |
|---|-------|--------|---------------------------|
| 1a | Nom des fichiers d'assets | **Decide** | `<atelier>-ex-<NNN>.<ext>`, `<NNN>` = `num` dans le module, renommage automatique |
| 1b | Nom des dossiers de module | **Decide** | Canonique `<section>-<NN>-<slug>` + migration des dossiers legacy en phase 0 |
| 2 | Non-reutilisation des ids | **Decide (technique)** | Compteur `idCounters` dans le catalogue |
| 3 | Champs derives | **Decide** | Conserves dans le JSON, recalcules automatiquement, controles en CI |
| 4a | Echelle des niveaux | **Decide** | `🟢 Débutant ⭐`, `🟡 Intermédiaire ⭐⭐`, `🟠 Avancé ⭐⭐⭐`, `🔴 Expert ⭐⭐⭐⭐`, commune aux trois ateliers |
| 4b | Affichage du niveau aux apprenants | **Valide, plus tard** | Evolution ulterieure, hors V1 admin |
| 5 | Apercu | **Decide (technique)** | Build automatique apres enregistrement, bouton « Apercu » sans etape manuelle |

## Resume

L'admin catalogue est un **outil local lie au depot**, distinct de l'espace formateur : il remplace l'edition manuelle de `exercises.structured.json`, des overrides et des assets par un CRUD guide, valide et publie par le flux Git existant. Son prerequis est la phase 0, qui fiabilise le catalogue et corrige une perte de progression deja presente lors des desactivations.
