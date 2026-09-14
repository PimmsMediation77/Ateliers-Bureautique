# Architecture cible - version connectee

Cette note decrit une evolution de l'application vers un mode hybride :

- mode local sans inscription, disponible meme sans serveur
- mode connecte, active quand un serveur local est joignable
- bascule progressive sans casser l'architecture actuelle

L'objectif est de conserver la simplicite actuelle pour un usage autonome, tout en ajoutant une source de verite partagee quand l'environnement reseau le permet.

## Objectifs

- centraliser la gestion des utilisateurs et des modules actifs
- partager la progression entre plusieurs postes
- conserver un mode local complet pour les usages sans compte
- detecter si le mode connecte est disponible avant de le proposer
- permettre une migration progressive depuis le stockage local actuel

## Constat actuel

Aujourd'hui, l'application fonctionne en `local-first` par poste :

- chaque machine choisit un dossier utilisateur
- les profils sont stockes dans `ProgressionAtelier/profil-utilisateur.json`
- la progression est stockee dans `ProgressionAtelier/progression-atelier.json`
- les rapports d'usabilite sont stockes localement

Avantages :

- aucun prerequis serveur
- fonctionnement simple et robuste en autonomie

Limites :

- pas de referentiel global des utilisateurs
- pas de gestion formateur centralisee
- risque de doublons ou d'incoherences entre postes
- difficile de suivre les modules actifs ou la progression a l'echelle d'un site

## Principe cible

La cible recommande est une architecture `offline-capable, online-when-available`.

Le poste client doit pouvoir demarrer dans deux modes :

1. `Mode local`
   - aucun compte requis
   - stockage local uniquement
   - aucune synchronisation serveur

2. `Mode connecte`
   - serveur local detecte et joignable
   - utilisateur reconnu ou selectionne
   - progression, droits et modules actifs fournis par le serveur
   - cache local pour resilier aux coupures temporaires

Le choix du mode ne doit pas etre impose au chargement. L'application doit d'abord verifier si le mode connecte est possible, puis seulement l'afficher comme option.

## Proposition d'architecture

### 1. Front navigateur

Le runtime navigateur actuel reste la base fonctionnelle :

- `model`
- `storage`
- `session`
- `controller`
- `profile`
- `progress`

Il evolue vers une couche d'abstraction de persistance avec deux fournisseurs :

- `localStorageProvider`
- `remoteSyncProvider`

Le controller ne doit pas connaitre les details reseau. Il interagit avec une facade de session et de donnees.

### 2. Serveur local

Le serveur local devient la source de verite du mode connecte.

Responsabilites recommandees :

- referentiel utilisateurs
- affectation des modules actifs
- suivi des progressions
- publication de metadonnees de version
- administration formateur
- emission de jetons de session legers si necessaire

Le serveur peut etre heberge sur le reseau local de la structure, sans exposition internet.

### 3. Stockage local cote client

Le stockage local reste utile, meme en mode connecte :

- cache de session
- cache des progressions recentes
- conservation du dernier mode choisi
- mode degrade si le serveur devient indisponible

Le local ne doit plus etre la source de verite en mode connecte, seulement un cache de travail.

## Detection du mode connecte

La detection doit etre explicite, rapide et non bloquante.

Sequence recommandee au demarrage :

1. charger l'application en mode local
2. lancer un `healthcheck` vers le serveur local en arriere-plan
3. si le serveur repond dans un delai court, afficher l'option `Utiliser le mode connecte`
4. sinon conserver uniquement le mode local

Contraintes :

- ne pas bloquer l'interface en attendant le reseau
- ne pas afficher une promesse de connexion si le serveur n'est pas joignable
- memoriser temporairement le resultat pour eviter des checks trop frequents

Exemple de signaux stockes localement :

- `serverAvailable`
- `lastServerCheckAt`
- `lastConnectedWorkspace`
- `preferredMode`

## Cas reseau a couvrir explicitement

La version connectee doit distinguer la disponibilite du `serveur local` de la disponibilite `internet`.

Principe :

- le mode connecte depend du serveur local
- internet n'est pas un prerequis fonctionnel du mode connecte
- sans serveur local joignable, l'application doit rester en mode local

### Cas 1 - connecte au reseau local avec internet

Situation :

- le poste voit le serveur local
- le poste a aussi acces a internet

Comportement attendu :

- proposer le mode connecte
- autoriser aussi le mode local
- utiliser le serveur local comme source de verite si le mode connecte est choisi

Notes :

- l'acces internet peut servir a d'autres usages annexes
- il ne doit pas changer la logique metier principale

### Cas 2 - connecte au reseau local sans internet

Situation :

- le poste voit le serveur local
- le poste n'a pas acces a internet

Comportement attendu :

- proposer le mode connecte
- autoriser aussi le mode local
- fonctionner normalement en mode connecte tant que le serveur local est joignable

Notes :

- ce cas doit etre considere comme nominal
- l'architecture ne doit pas dependre d'un service externe internet pour demarrer ou synchroniser

### Cas 3 - connecte a internet seulement

Situation :

- le poste a internet
- le poste ne voit pas le serveur local

Comportement attendu :

- ne pas proposer le mode connecte base sur le serveur local
- demarrer en mode local uniquement
- afficher eventuellement un message du type `Serveur local indisponible`

Notes :

- internet seul ne suffit pas dans l'architecture cible actuelle
- si un jour un serveur distant ou cloud est introduit, ce cas pourra evoluer
- dans la cible de cette note, `internet sans serveur local` reste un cas `mode local`

### Regle de decision

La regle fonctionnelle recommandee est donc :

- `serveur local joignable` => mode connecte possible
- `serveur local non joignable` => mode connecte non propose
- `internet joignable ou non` => information secondaire, sans impact sur l'eligibilite du mode connecte local

### Tableau de decision technique

| Reseau local | Serveur local joignable | Internet | Mode propose a l'utilisateur | Provider actif par defaut | Synchronisation distante |
| --- | --- | --- | --- | --- | --- |
| oui | oui | oui | `Local` et `Connecte` | `localStorageProvider` au chargement, puis `remoteSyncProvider` si choisi | oui |
| oui | oui | non | `Local` et `Connecte` | `localStorageProvider` au chargement, puis `remoteSyncProvider` si choisi | oui |
| oui | non | oui | `Local` uniquement | `localStorageProvider` | non |
| oui | non | non | `Local` uniquement | `localStorageProvider` | non |
| non | non | oui | `Local` uniquement | `localStorageProvider` | non |
| non | non | non | `Local` uniquement | `localStorageProvider` | non |

Regles UX associees :

- l'application demarre toujours en capacite locale
- le mode connecte n'apparait que si le `healthcheck` du serveur local reussit
- internet seul n'active jamais le mode connecte dans cette architecture
- si le serveur local devient indisponible pendant une session connectee, l'interface doit signaler un mode degrade et mettre la synchronisation en attente

## Modes utilisateur

### Mode local invite

Usage cible :

- demarrage rapide
- utilisateur ponctuel
- atelier autonome

Caracteristiques :

- aucun enregistrement obligatoire
- dossier local choisi manuellement si necessaire
- progression conservee seulement sur le poste ou le dossier choisi

### Mode connecte utilisateur

Usage cible :

- poste relie au serveur local
- besoin de retrouver un usager sur plusieurs machines
- besoin de pilotage formateur

Caracteristiques :

- liste d'utilisateurs centralisee
- modules actifs decides par le serveur
- progression synchronisee
- rapports consolidables

### Mode connecte formateur

Usage cible :

- administration locale du dispositif

Caracteristiques :

- gestion des utilisateurs
- activation ou desactivation des modules
- consultation des progressions
- export ou lecture des rapports

## Domaine de donnees cible

Le modele metier serveur peut etre structure autour des entites suivantes :

- `User`
  - `id`
  - `firstName`
  - `lastName` ou `displayName`
  - `initials`
  - `status`
  - `createdAt`
  - `updatedAt`

- `ModuleAssignment`
  - `userId`
  - `appId` (`word`, `excel`, `powerpoint`)
  - `enabled`
  - `allowedThemes` optionnel
  - `updatedAt`

- `ProgressSnapshot`
  - `userId`
  - `appId`
  - `completedExerciseIds`
  - `history`
  - `lastExerciseId`
  - `updatedAt`
  - `source` (`local`, `server`, `merged`)

- `UsabilityReport`
  - `userId`
  - `appId`
  - `exerciseId`
  - `responses`
  - `createdAt`

- `DeviceRegistration` optionnel
  - `deviceId`
  - `label`
  - `lastSeenAt`
  - `modeCapability`

## API cible

Le protocole peut rester simple en HTTP JSON sur le reseau local.

Endpoints minimaux :

- `GET /health`
- `GET /config/client`
- `GET /users`
- `GET /users/:id`
- `GET /users/:id/modules`
- `GET /users/:id/progress?appId=word`
- `PUT /users/:id/progress?appId=word`
- `POST /users/:id/usability-reports?appId=word`
- `GET /admin/users`
- `POST /admin/users`
- `PATCH /admin/users/:id`
- `PUT /admin/users/:id/modules`

Le serveur peut retourner une configuration de capacites :

- mode connecte autorise ou non
- login requis ou non
- apps disponibles
- nom de la structure

## Strategie de session

Deux strategies sont possibles.

### Option A - sans authentification forte au debut

L'utilisateur choisit simplement son profil depuis une liste serveur.

Avantages :

- mise en place rapide
- faible friction

Limites :

- pas adapte si des contraintes fortes de confidentialite apparaissent

### Option B - authentification legere

Le serveur demande un code, un badge ou un identifiant simple.

Avantages :

- meilleur controle des sessions

Limites :

- plus de complexite UX

Recommendation :

commencer par l'option A si l'objectif premier est la gestion centralisee plutot que la securisation forte.

## Synchronisation

Le comportement recommande est different selon le mode.

### En mode local

- lecture et ecriture locales uniquement

### En mode connecte

- chargement initial depuis le serveur
- ecriture locale immediate pour fluidifier l'UX
- synchronisation serveur ensuite
- marquage des ecritures en attente si le serveur est temporairement indisponible

La synchronisation doit idealement etre :

- idempotente
- horodatee
- tolerante aux doublons

Une strategie simple de premiere version :

- le client envoie l'etat complet de progression par application
- le serveur remplace si `updatedAt` client est plus recent
- un journal fin pourra venir plus tard si necessaire

## Decision V1 retenue pour les dossiers utilisateur

La V1 connectee ne doit pas essayer de maintenir deux sources de verite actives en parallele.

Decision retenue :

- sans serveur local disponible, l'application travaille sur le dossier local machine
- avec serveur local disponible, l'application travaille sur le dossier utilisateur serveur
- une session n'utilise qu'un seul dossier actif a la fois
- la synchronisation automatique bidirectionnelle complete n'est pas un objectif de V1

Cette regle permet de garder un comportement previsible et de limiter fortement les risques d'ecrasement de progression.

## Structure cible des dossiers utilisateur

Le format de dossier actuel est conserve.

Pour chaque utilisateur :

- un dossier par utilisateur
- un sous-dossier `ProgressionAtelier`
- les fichiers de progression, profil et rapports dedans

Exemples :

- local machine : `C:\Users\...\Alice\ProgressionAtelier`
- serveur local : `\\serveur\Ateliers\Users\Alice\ProgressionAtelier`

En V1, si le serveur local est accessible, le dossier utilisateur serveur devient la base de travail prioritaire.

## Workflow V1 de selection du dossier actif

### Au demarrage

Au lancement de l'application :

1. l'application se charge avec ses capacites locales
2. elle lance un `healthcheck` vers le serveur local
3. elle determine si le dossier utilisateur serveur est accessible
4. elle choisit un `dossier actif` pour la session

Regle de priorite :

- `serveur joignable` + `dossier utilisateur serveur accessible` => dossier actif `serveur`
- sinon => dossier actif `local`

### Pendant la session

Pendant une session :

- le dossier actif ne change pas brutalement
- l'application lit et ecrit uniquement dans la source active
- si le serveur redevient disponible en cours d'usage, l'application signale seulement qu'une reprise est possible plus tard

Exemple de message :

- `Serveur local de nouveau disponible. Synchronisation possible a la prochaine ouverture.`

### Au retour du reseau local

Quand le serveur local redevient disponible, la comparaison entre dossier local et dossier serveur se fait preferentiellement :

- au redemarrage
- ou sur action explicite de l'utilisateur

La V1 ne doit pas tenter une bascule silencieuse en plein milieu d'une session.

## UI actuellement en place dans la V1

La V1 deployee ne se limite plus a une simple priorite implicite local/serveur.

L'interface actuelle met deja en place :

- un statut runtime visible (`Mode local`, `Serveur local disponible`, `Serveur local indisponible, mode local`)
- un choix explicite dans la modale utilisateur entre `Dossier local` et `Dossier serveur`
- une aide contextuelle differente selon le mode choisi
- une re-utilisation prioritaire des dossiers deja enregistres pour le mode courant
- une page profil qui affiche le mode actif, le dossier actif et les chemins reseau configures

## Parcours utilisateur V1 actuellement implemente

### Parcours local

Quand l'utilisateur choisit `Dossier local` :

- l'interface parle de `choisir ou creer un dossier local`
- les dossiers deja memorises en local sont proposes en priorite
- la session reste totalement utilisable meme sans serveur local

### Parcours serveur

Quand l'utilisateur choisit `Dossier serveur` :

- l'interface parle d'`ouvrir un dossier serveur existant`
- si `networkShares.userFoldersRoot` est renseigne, ce chemin est affiche comme repere
- les dossiers deja memorises cote serveur sont proposes en priorite

Important :

- en V1, le parcours serveur vise d'abord l'ouverture d'un dossier deja existant sur le partage
- la creation automatisee d'une arborescence serveur administree n'est pas encore un objectif

## Role concret de `deployment-config.json` en V1

Le fichier `deployment-config.json` ne sert plus seulement a preparer une architecture future.

En V1 actuelle, il pilote deja :

- l'activation ou non de la detection serveur
- l'URL et le `healthcheck` du serveur local
- le libelle de l'environnement poste
- les chemins reseau affiches dans le profil
- le chemin repere du partage utilisateurs via `networkShares.userFoldersRoot`

Consequence pratique :

- une fois le reseau local pret, il suffit souvent de renseigner ce fichier pour que le poste sache quoi privilegier et quoi afficher
- l'acces au dossier reste toutefois soumis a la permission navigateur lors de la premiere ouverture

## Etats fonctionnels de V1

### Etat 1 - session locale

Conditions :

- serveur local indisponible
- ou dossier utilisateur serveur inaccessible

Comportement :

- lecture et ecriture sur le dossier local
- interface en `Mode local`

### Etat 2 - session serveur

Conditions :

- serveur local joignable
- dossier utilisateur serveur accessible

Comportement :

- lecture et ecriture sur le dossier serveur
- interface en `Mode connecte`

### Etat 3 - serveur revenu pendant une session locale

Conditions :

- session locale deja ouverte
- serveur local de nouveau joignable

Comportement :

- on garde la session locale en cours
- on affiche une information de reprise
- aucune bascule automatique immediate

### Etat 4 - divergence detectee au prochain chargement

Conditions :

- un etat local existe
- un etat serveur existe
- les deux ne sont pas identiques

Comportement :

- on applique les regles de resolution de conflit V1

## Metadonnees minimales a ajouter aux progres

Pour rendre les decisions fiables, chaque fichier de progression doit embarquer au minimum :

- `updatedAt`
- `deviceId`
- `storageMode`
- `lastSyncAt` optionnel en V1 mais recommande

Exemple :

```json
{
  "meta": {
    "updatedAt": "2026-07-07T14:30:00Z",
    "deviceId": "poste-mediatheque-01",
    "storageMode": "local",
    "lastSyncAt": "2026-07-07T09:00:00Z"
  }
}
```

## Regles de comparaison au redemarrage

Quand le serveur local est accessible, la V1 compare l'etat local et l'etat serveur.

### Cas 1 - seul le serveur existe

Action :

- charger le serveur

### Cas 2 - seul le local existe

Action :

- proposer de copier la version locale vers le serveur
- puis continuer sur le serveur si l'utilisateur confirme

### Cas 3 - local et serveur existent, serveur plus recent

Action :

- charger le serveur
- optionnellement archiver ou ignorer la copie locale

### Cas 4 - local et serveur existent, local plus recent

Action :

- proposer de remplacer le serveur par le local
- ou de rester local pour cette session

### Cas 5 - local et serveur ont diverge

Exemple :

- travail hors reseau sur un poste
- progression modifiee aussi depuis un autre poste sur le serveur

Action V1 :

- ne pas faire de fusion automatique fine
- demander une decision explicite

## Resolution de conflit V1

La resolution de conflit V1 doit rester simple.

Choix proposes :

- `Garder la version serveur`
- `Garder la version locale`
- `Exporter la version locale avant de charger le serveur`

Objectif :

- eviter tout ecrasement silencieux
- reporter les fusions complexes a une version ulterieure

Etat implemente actuellement :

- si une version plus recente est detectee de l'autre cote (`local` ou `serveur`), l'application ouvre une modale dediee
- cette modale remplace le `confirm()` navigateur
- elle presente la version actuelle, la version proposee et leurs dates connues
- l'utilisateur choisit explicitement quelle version utiliser pour la session en cours

## Messages UI recommandes

Messages de statut utiles :

- `Mode actuel : dossier local`
- `Mode actuel : dossier serveur`
- `Serveur local indisponible, poursuite en local`
- `Serveur local disponible`
- `Une version plus recente existe sur le serveur`
- `Conflit detecte entre la version locale et la version serveur`
- `Synchronisation en attente`

## Ce que la V1 fait et ne fait pas

### V1 fait

- priorite au dossier serveur quand il est disponible
- repli sur dossier local sinon
- un seul dossier actif par session
- comparaison des etats au redemarrage
- reprise assistee en cas de divergence

### V1 ne fait pas

- fusion automatique fine de deux progressions
- synchronisation temps reel multi-postes
- double ecriture simultanee local + serveur comme source de verite

## Evolution du code actuel

Pour rester compatible avec l'existant, la migration devrait se faire en couches.

### Etape 1 - abstraire le stockage

Introduire une interface logique du type :

- `loadUserContext()`
- `saveUserContext()`
- `loadProgress(appId, userRef)`
- `saveProgress(appId, userRef, progress)`
- `loadModuleAssignments(userRef)`
- `saveUsabilityReport(appId, userRef, report)`

L'implementation actuelle fichier/local devient un provider.

### Etape 2 - ajouter un provider serveur

Creer un provider reseau qui consomme l'API locale.

### Etape 3 - ajouter un orchestrateur de mode

Creer un composant de decision qui :

- detecte le serveur
- choisit le provider actif
- expose l'etat de connectivite au controller

### Etape 4 - ajouter l'UI de choix de mode

Ajouter un ecran ou bandeau de type :

- `Continuer en local`
- `Utiliser le mode connecte`

Cette UI n'apparait que si le serveur est disponible.

### Etape 5 - ajouter l'administration formateur

Construire une page admin se basant uniquement sur l'API serveur, sans dependre du stockage local.

Specification detaillee : [FEATURE_ESPACE_FORMATEUR.md](./FEATURE_ESPACE_FORMATEUR.md).

## Preparation du terrain des maintenant

Oui, il est possible de preparer le terrain pour qu'une future mise en service sur reseau local repose surtout sur de la configuration.

Le repo a deja un point d'entree de configuration par application dans :

- `apps/word/js/app-config.js`
- `apps/excel/js/app-config.js`
- `apps/powerpoint/js/app-config.js`

Ces fichiers portent deja les noms globaux, les identifiants de stockage et certaines conventions de fichiers. C'est le bon endroit pour brancher ensuite une configuration de connectivite.

### Objectif de cette preparation

Permettre le scenario suivant :

1. le code du mode hybride est deja en place
2. le serveur local devient accessible plus tard
3. on renseigne quelques valeurs de configuration
4. le mode connecte devient disponible sans refonte de logique

### Strategie recommandee

Introduire une configuration applicative etendue, separee entre :

- configuration stable versionnee dans le repo
- configuration editable de deploiement

### Fichier editable recommande

Recommendation simple :

- conserver `app-config.js` pour la configuration technique versionnee
- ajouter un fichier editable de deploiement, par exemple `deployment-config.json`

Exemples de chemin possibles :

- `apps/word/app/deployment-config.json`
- `apps/excel/app/deployment-config.json`
- `apps/powerpoint/app/deployment-config.json`

ou, si le meme environnement doit piloter toutes les apps :

- `pages/config/deployment-config.json`

La seconde option est preferable si le serveur local, les chemins reseau et les politiques de mode doivent etre mutualises entre Word, Excel et PowerPoint.

### Contenu type du fichier editable

Exemple :

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
  "networkShares": {
    "documentsRoot": "",
    "exportsRoot": "",
    "reportsRoot": ""
  },
  "features": {
    "trainerAdmin": false,
    "centralUserDirectory": false,
    "remoteProgressSync": false
  }
}
```

### Ce que ce fichier doit piloter

- URL du serveur local
- endpoint de `healthcheck`
- delai maximal avant de considerer le serveur indisponible
- mode par defaut
- autorisation du mode local invite
- activation ou non des fonctions connectees
- chemins reseau optionnels si vous voulez plus tard stocker certains exports dans des dossiers partages

### Attention sur les dossiers

Un fichier de configuration peut tres bien contenir des `chemins cibles`, mais il ne pourra pas, a lui seul, donner l'acces au navigateur a des dossiers reseau.

Avec l'architecture actuelle basee sur la File System Access API :

- le navigateur doit obtenir une autorisation utilisateur pour acceder a un dossier
- un chemin type `Z:\\Dossiers\\Ateliers` ne suffit pas a ouvrir automatiquement ce dossier

Conclusion :

- oui pour configurer `quel dossier on souhaite utiliser`
- non pour garantir un acces automatique complet uniquement par chemin

Le plus realiste est donc :

- configurer des `dossiers recommandes` ou `libelles de partage`
- laisser le navigateur demander l'autorisation la premiere fois
- memoriser ensuite le handle localement quand c'est possible

### Ce qu'on peut rendre operationnel par simple configuration plus tard

Si le code est prepare a l'avance, les elements suivants pourront etre actives surtout par configuration :

- URL du serveur local
- activation du mode connecte
- affichage du bouton `Utiliser le mode connecte`
- timeout et politique de bascule
- activation de la page formateur
- choix des features connectees

### Ce qui demandera quand meme du code en amont

Pour que cette promesse tienne, il faudra preparer maintenant :

- l'abstraction `provider local` / `provider distant`
- le chargeur de configuration editable
- le `healthcheck` serveur
- l'orchestrateur de mode
- les drapeaux de fonctionnalites

Une fois ces briques en place, l'ouverture du reseau local pourra effectivement se faire avec peu de changements, souvent limites a :

- modifier une URL
- activer quelques booleens
- renseigner quelques chemins ou libelles d'environnement

## Recommandation concrete

La meilleure preparation est :

1. ajouter un chargeur de configuration de deploiement
2. definir des cles stables pour `server`, `features` et `environment`
3. brancher la detection du serveur sur cette config
4. garder le mode local totalement fonctionnel en absence de config ou de serveur

Ainsi, quand le reseau local sera pret, tu pourras surtout renseigner un fichier editable plutot que reouvrir l'architecture de fond.

## Contraintes UX recommandees

- l'utilisateur ne doit jamais etre bloque si le serveur est absent
- le mode local doit rester un premier chemin valide
- le mode connecte ne doit etre propose qu'en cas de disponibilite confirmee
- les messages de statut doivent etre simples : `Mode local`, `Serveur disponible`, `Synchronisation en attente`

## Risques a anticiper

- confusion entre profil local et profil serveur si les libelles sont flous
- divergence de progression si on autorise des usages mixtes sans regle de fusion
- dependance excessive au reseau si le cache local est insuffisant
- dette technique si le mode connecte est ajoute directement dans le controller sans abstraction

## Recommandations

- garder le mode local comme mode de secours officiel
- introduire des providers de donnees avant toute UI admin
- commencer par une synchro simple par snapshot
- separer clairement `identite locale invite` et `identite serveur`
- afficher le mode courant en permanence dans l'interface

## Feuille de route suggeree

1. definir le contrat de donnees commun client/serveur
2. abstraire le stockage actuel dans `atelier-core`
3. ajouter le `server availability check`
4. implementer un provider HTTP local
5. afficher le choix `local` ou `connecte` seulement si le serveur est detecte
6. ajouter la liste centralisee des utilisateurs
7. ajouter la gestion des modules actifs
8. ajouter la vue formateur (detail : [FEATURE_ESPACE_FORMATEUR.md](./FEATURE_ESPACE_FORMATEUR.md))

## Decision cible

La meilleure cible pour ce projet est une architecture hybride :

- `mode local par defaut`
- `mode connecte optionnel quand disponible`
- `serveur local comme source de verite pour la gestion globale`

Cette approche respecte le besoin terrain actuel tout en ouvrant une trajectoire propre vers une vraie gestion multi-postes.
