# Feature: Espace formateur (mode connecte)

## Objectif

Donner au formateur une vue centralisee pour piloter le dispositif multi-postes :

- consulter la liste des usagers ;
- suivre les progressions Word / Excel / PowerPoint ;
- lire les syntheses QCM / usabilite ;
- activer ou desactiver des modules par usager.

La source de verite est le **serveur local**. L'espace formateur ne lit pas les dossiers locaux des postes et ne fait pas de recuperation de fichiers a l'arrache.

## Contexte et dependances

Cette feature s'appuie sur la [version connectee](./ARCHITECTURE_VERSION_CONNECTEE.md).

Elle n'a de sens que si :

1. un serveur local existe sur le reseau du site ;
2. les ateliers fonctionnent en **mode connecte** pour les usagers concernes ;
3. les progressions et feedbacks QCM sont deja pousses vers le serveur via le provider distant.

Documents lies :

- [Architecture version connectee](./ARCHITECTURE_VERSION_CONNECTEE.md) — providers, mode local/connecte, sync snapshots, flags ;
- [QCM et rapport d'usabilite](./FEATURE_QCM_USABILITE.md) — modele `feedback` et heuristiques de rapport ;
- [Gestion actif / inactif](../../../docs/GESTION_ACTIF_INACTIF.md) — masquage global fichier (complementaire, pas remplace en mode local).

### Etat actuel du produit

| Element | Etat |
|---------|------|
| Ateliers apprenant local-first | Livre |
| QCM + rapport par usager (dossier local) | Livre |
| `deployment-config.json` + flags `trainerAdmin`, `centralUserDirectory`, `remoteProgressSync` | Present, desactives |
| Serveur local + API | Non livre |
| Providers local / remote | A finaliser |
| UI espace formateur | Absente |

## Perimetre V1

### Inclus

- page / application formateur distincte du parcours apprenant ;
- lecture exclusive via API serveur (aucun File System Access cote formateur) ;
- annuaire usagers : liste, creation, desactivation ;
- fiche usager : progression par atelier (`word`, `excel`, `powerpoint`) ;
- synthese usabilite par usager (reprise des heuristiques QCM) ;
- affectation de modules actifs par usager et par atelier ;
- activation uniquement si serveur joignable et `features.trainerAdmin: true` ;
- auth legere optionnelle (code formateur / reseau de confiance) — option A sans auth forte acceptable en V1 site interne.

### Exclus (hors scope V1)

- CMS d'edition du catalogue d'exercices ;
- planning / reservation d'ateliers ;
- scan ou aggregation de dossiers `ProgressionAtelier` locaux ;
- fusion automatique fine local ↔ serveur ;
- synchronisation temps reel multi-postes ;
- authentification forte (SSO, comptes nominatifs complexes) ;
- exposition internet du serveur ;
- remplacement du mode local invite (il reste le chemin par defaut hors serveur).

## Principes produits

1. **Serveur = source de verite** en mode connecte ; le local n'est qu'un cache / secours pour l'apprenant.
2. **Une session apprenant = une source** (local ou serveur), jamais les deux en ecriture parallele en V1.
3. **Espace formateur = API only** ; pas de dependance au stockage navigateur du poste formateur.
4. **Mode local intact** : sans serveur, l'atelier apprenant continue comme aujourd'hui ; l'espace formateur n'est pas propose.
5. **Pas de recuperation magique** : seules les progressions synchronisees en mode connecte sont visibles.

## Parcours

### Apprenant (prerequis d'alimentation)

1. Le poste detecte le serveur (`healthcheck`).
2. L'usager choisit **mode connecte** et un profil serveur.
3. A chaque validation d'exercice + QCM, le client envoie le snapshot de progression.
4. Les modules actifs eventuels viennent du serveur (`ModuleAssignment`).

Sans cette etape, la fiche formateur reste vide ou incomplete pour cet usager.

### Formateur

1. Ouvre l'espace formateur (URL dediee ou entree protegee).
2. Verifie que le serveur est joignable ; sinon message bloquant clair.
3. Consulte la liste des usagers.
4. Ouvre une fiche : progression, historique recent, synthese QCM.
5. Ajuste si besoin les modules actifs pour un usager / atelier.
6. (Optionnel V1.1) exporte une synthese multi-usagers.

## Architecture

```text
Postes apprenants (mode connecte)
  ├─ GET  /users, /users/:id/modules, /users/:id/progress
  ├─ PUT  /users/:id/progress?appId=...
  └─ POST /users/:id/usability-reports?appId=...
              │
              ▼
        Serveur local (LAN)
          User, ProgressSnapshot, UsabilityReport, ModuleAssignment
              │
              ▼
Poste formateur
  └─ UI formateur → /admin/* (+ lectures progress / reports)
```

### Couches client

| Couche | Role |
|--------|------|
| `localStorageProvider` (existant evolue) | Dossier utilisateur File System Access |
| `remoteSyncProvider` | HTTP vers serveur local |
| Orchestrateur de mode | Healthcheck, choix provider, exposition du statut |
| Runtime ateliers | Inchange fonctionnellement ; persistance via facade |
| UI formateur | Nouveau front ; consomme uniquement l'API admin / lecture |

L'espace formateur ne reutilise pas `createAtelierFileStorage` pour ses donnees metier.

### Emplacement recommande dans le monorepo

| Piece | Emplacement |
|-------|-------------|
| Providers / orchestrateur | `packages/atelier-core/browser/` |
| Contrat API / types partages (si besoin) | `packages/atelier-core/` ou package serveur |
| Serveur local | nouveau package (ex. `packages/atelier-server`) — a creer |
| UI formateur | `pages/formateur/` (portail) ou HTML partage sync vers les apps |
| Activation | `apps/*/deployment-config.json` (et copies `app/`) |

## Modele de donnees

Alignement avec la version connectee.

### User

```json
{
  "id": "usr_alice",
  "firstName": "Alice",
  "displayName": "Alice",
  "initials": "ALI",
  "status": "active",
  "createdAt": "2026-09-10T10:00:00.000Z",
  "updatedAt": "2026-09-10T10:00:00.000Z"
}
```

`status` : `active` | `disabled`.

### ProgressSnapshot

Reprend le contrat progression v3 deja utilise cote client :

```json
{
  "userId": "usr_alice",
  "appId": "word",
  "version": 3,
  "updatedAt": "2026-09-10T11:00:00.000Z",
  "completedIds": ["ex-001"],
  "lastExerciseId": "ex-001",
  "history": [],
  "feedback": [
    {
      "exerciseId": "ex-001",
      "submittedAt": "2026-09-10T11:00:00.000Z",
      "difficulty": "adapted",
      "clarity": "clear",
      "autonomy": "independent",
      "comment": ""
    }
  ],
  "source": "server"
}
```

Regles de sync V1 (snapshots) :

- le client envoie l'etat complet par `appId` ;
- le serveur remplace si `updatedAt` client est plus recent ;
- pas de fusion fine champ a champ en V1.

### ModuleAssignment

```json
{
  "userId": "usr_alice",
  "appId": "word",
  "enabled": true,
  "allowedThemes": ["m01", "m02"],
  "updatedAt": "2026-09-10T10:30:00.000Z"
}
```

- si aucune assignment : politique par defaut documentee cote serveur (ex. tous les modules actifs du catalogue, hors overrides globaux deploiement) ;
- `allowedThemes` optionnel ; absence = tous les themes autorises pour cet `appId` si `enabled: true`.

### UsabilityReport (vue serveur)

Peut etre :

- derive a la volee depuis `ProgressSnapshot.feedback`, ou
- materialise via `POST .../usability-reports`.

La vue formateur V1 peut se contenter du derive depuis `feedback` pour eviter un double stockage.

## API

Protocole : HTTP JSON sur le LAN.

### Commun (apprenant + formateur)

| Methode | Chemin | Role |
|---------|--------|------|
| `GET` | `/health` | Disponibilite serveur |
| `GET` | `/config/client` | Capacites (mode connecte, apps, label structure) |
| `GET` | `/users` | Liste usagers actifs (selection profil) |
| `GET` | `/users/:id` | Detail usager |
| `GET` | `/users/:id/modules` | Modules autorises |
| `GET` | `/users/:id/progress?appId=` | Snapshot progression |
| `PUT` | `/users/:id/progress?appId=` | Remplacement snapshot si plus recent |
| `POST` | `/users/:id/usability-reports?appId=` | Optionnel si materialisation separee |

### Admin formateur

| Methode | Chemin | Role |
|---------|--------|------|
| `GET` | `/admin/users` | Liste complete (y compris disabled) |
| `POST` | `/admin/users` | Creation |
| `PATCH` | `/admin/users/:id` | Mise a jour (nom, status, …) |
| `PUT` | `/admin/users/:id/modules` | Remplacement des assignments |
| `GET` | `/admin/users/:id/progress?appId=` | Alias lecture (ou reutiliser `GET /users/...`) |
| `GET` | `/admin/progress-summary` | Optionnel V1.1 — agregat multi-usagers |

Reponse type `/config/client` :

```json
{
  "connectedModeAllowed": true,
  "loginRequired": false,
  "trainerAdminAllowed": true,
  "availableApps": ["word", "excel", "powerpoint"],
  "structureLabel": "pimms-site-01"
}
```

## UI formateur V1

### Entree

- URL dediee recommandee : `pages/formateur/` (ou equivalent deploye) ;
- alternative : route protegee dans le portail ;
- visible seulement si `trainerAdmin` + serveur OK ;
- sinon message : serveur indisponible / feature desactivee.

### Ecrans

#### 1. Accueil / statut

- label structure ;
- etat serveur ;
- nombre d'usagers actifs ;
- liens vers liste usagers.

#### 2. Liste des usagers

Colonnes minimales :

- nom / initiales ;
- statut ;
- derniere activite (`updatedAt` max des snapshots) ;
- actions : ouvrir fiche, desactiver.

Actions : creer un usager.

#### 3. Fiche usager

Onglets ou sections par `appId` :

- exercices completes / total visible ;
- dernier exercice ;
- courbe ou compteurs simples (reutiliser les notions de la page Progression) ;
- bloc usabilite :
  - total feedbacks ;
  - moyennes difficulte / clarte / autonomie ;
  - exercices a surveiller ;
  - dernier feedback.

#### 4. Modules

- liste des themes/modules du catalogue de l'atelier selectionne ;
- cases a cocher / toggles par usager ;
- sauvegarde via `PUT /admin/users/:id/modules`.

Note : le masquage global `availability-overrides.js` reste un levier deploiement contenu ; l'assignment serveur est le levier **par usager** en mode connecte.

## Configuration

Fichier editable existant : `deployment-config.json`.

```json
{
  "environment": {
    "label": "pimms-site-01",
    "defaultMode": "local",
    "allowGuestLocalMode": true,
    "offerConnectedModeWhenServerReachable": true
  },
  "server": {
    "enabled": true,
    "baseUrl": "http://atelier-local:8787",
    "healthcheckPath": "/health",
    "clientConfigPath": "/config/client",
    "timeoutMs": 1500
  },
  "features": {
    "trainerAdmin": true,
    "centralUserDirectory": true,
    "remoteProgressSync": true
  }
}
```

| Flag | Role pour cette feature |
|------|-------------------------|
| `server.enabled` | Autorise la detection / usage serveur |
| `remoteProgressSync` | Les ateliers poussent/lisent la progression distante |
| `centralUserDirectory` | Selection profil depuis l'annuaire serveur |
| `trainerAdmin` | Affiche / autorise l'espace formateur |

Activer `trainerAdmin` sans `remoteProgressSync` ni serveur est un etat invalide : l'UI doit refuser de promettre des donnees.

## Strategie d'authentification V1

Recommandation alignee version connectee : **option A**.

- Apprenant : choisit son profil dans la liste serveur (friction minimale).
- Formateur : acces admin sur le LAN ; code PIN simple optionnel si besoin.
- Pas de SSO en V1.
- Confidentialite : adapter si le site exige un cloisonnement plus fort (alors option B avant mise en prod).

## Feuille de route d'implementation

Ordre impose (l'UI formateur en dernier).

### Phase 0 — Contrats

- figer les schemas `User`, `ProgressSnapshot`, `ModuleAssignment` ;
- documenter les codes erreur HTTP et la regle `updatedAt` ;
- etendre le contrat DOM / routes si l'UI est dans le runtime partage.

### Phase 1 — Serveur minimal

- `GET /health`, `GET /config/client` ;
- CRUD usagers basique ;
- `GET/PUT` progress par `userId` + `appId` ;
- stockage serveur simple (SQLite ou fichiers JSON versionnes cote serveur).

### Phase 2 — Provider remote + mode connecte apprenant

- abstraire `loadProgress` / `saveProgress` / modules dans `atelier-core` ;
- brancher healthcheck + choix local / connecte ;
- valider qu'un exercice termine en mode connecte apparait bien cote serveur.

### Phase 3 — Espace formateur lecture seule

- liste + fiche usager + synthese QCM ;
- flag `trainerAdmin` ;
- aucun write admin encore (sauf eventuellement creation usager si absente du flux apprenant).

### Phase 4 — Pilotage

- `PUT` modules par usager ;
- creation / desactivation usagers depuis l'UI ;
- export CSV / JSON multi-usagers (V1.1 acceptable).

### Critere de done V1

- un usager termine un exercice en mode connecte sur le poste A ;
- le formateur voit la progression et le QCM sur le poste B sans ouvrir de dossier fichier ;
- un module desactive pour cet usager n'apparait plus dans son atelier connecte ;
- sans serveur, les ateliers restent utilisables en local et l'espace formateur affiche un etat indisponible.

## Choix techniques

- mutualiser la logique de rapport QCM (heuristiques deja dans le modele client) : calcul cote serveur **ou** reutilisation d'une fonction partagee alimentee par le snapshot ;
- ne pas coupler l'UI formateur au `controller` apprenant ;
- snapshots complets plutot que patchs granulaires en V1 ;
- serveur LAN uniquement ; internet non requis ;
- conserver les fichiers locaux en mode non connecte pour ne pas casser l'existant.

## Risques et mitigations

| Risque | Mitigation |
|--------|------------|
| UI formateur vide car usagers restent en local | UX claire : mode connecte requis ; doc exploitation site |
| Confusion profil local vs serveur | Libelles explicites + statut de mode permanent |
| Ecrasement de progression | Regle `updatedAt` ; une source active par session |
| Feature flag partiel | Guard : `trainerAdmin` implique serveur + sync |
| Perimetre qui derive vers un CMS | Hors scope explicite ; contenu reste Git / overrides |
| Securite LAN trop ouverte | PIN formateur ; pas d'exposition WAN |

## Exploitation site (cible)

1. Deployer le serveur local sur une machine du site.
2. Renseigner `server.baseUrl` dans les `deployment-config.json` des ateliers.
3. Activer `remoteProgressSync`, `centralUserDirectory`, `trainerAdmin`.
4. Former les mediateurs : usagers en mode connecte pendant les ateliers suivis.
5. Ouvrir l'espace formateur sur le poste d'animation.

## Hors scope rappelle et suites

### V1.1

- `GET /admin/progress-summary` (agregat multi-usagers, par exercice / theme) ;
- export consolide ;
- filtre usabilite par theme (lien QCM V1.1).

### V2

- auth formateur plus stricte ;
- tableaux de bord comparatifs entre usagers ;
- historique d'assignments ;
- eventuellement materialisation avancee des rapports.

### Explicitement non retenu

- recuperation a l'arrache des dossiers locaux ;
- dependance a un partage SMB comme source de verite de l'UI formateur (un partage peut exister pour d'autres usages fichier, mais ce n'est pas le backend de cette feature).

## Resume

L'espace formateur est le **dernier maillon** de la chaine connectee : serveur + sync apprenant d'abord, puis UI admin en lecture/pilotage sur API. Il transforme des progressions et QCM deja centralises en outil de suivi de site, sans casser le mode local autonome.
