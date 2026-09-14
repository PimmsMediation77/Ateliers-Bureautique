# Feature: QCM de fin d'exercice et rapport d'usabilite

## Objectif

Ajouter un mini-QCM a la fin de l'exercice, au moment de la sauvegarde logique, pour:

- capter un ressenti utilisateur rapide,
- mesurer la progression d'autonomie de l'apprenant,
- produire un premier rapport d'usabilite exploitable par un formateur.

## Perimetre V1

- QCM obligatoire quand un exercice est marque comme termine depuis l'ecran exercice.
- Stockage du feedback dans le fichier de progression utilisateur deja existant.
- Rapport d'usabilite visible dans la page `Progression`.
- Export automatique de `rapport-usabilite.json` dans `ProgressionAtelier`.
- Aucune centralisation multi-utilisateurs cote serveur en V1.

## Parcours utilisateur

### Validation d'un exercice

Quand l'utilisateur clique sur `Marquer comme fait` ou `Suivant` depuis un exercice non termine:

1. la modale de rappel de sauvegarde s'affiche,
2. si l'utilisateur continue, le QCM de fin d'exercice s'affiche,
3. l'utilisateur repond au QCM,
4. l'exercice est marque termine,
5. la progression enrichie est enregistree.

### QCM

Questions V1:

- `Difficulte`
  - `Trop facile`
  - `Adaptee`
  - `Difficile`
- `Clarte des consignes`
  - `Pas claire`
  - `Moyenne`
  - `Tres claire`
- `Autonomie ressentie`
  - `J'ai eu besoin d'aide`
  - `Un peu d'aide`
  - `En autonomie`
- `Commentaire`
  - champ libre optionnel, court

## Donnees

Le fichier de progression utilisateur passe en `version: 3`.

Nouvelle cle: `feedback`

```json
{
  "version": 3,
  "updatedAt": "2026-07-06T15:00:00.000Z",
  "completedIds": ["ex-001"],
  "lastExerciseId": "ex-001",
  "history": [],
  "feedback": [
    {
      "exerciseId": "ex-001",
      "submittedAt": "2026-07-06T15:00:00.000Z",
      "difficulty": "adapted",
      "clarity": "clear",
      "autonomy": "independent",
      "comment": "Besoin d'aide pour trouver la commande"
    }
  ]
}
```

Regles V1:

- un seul feedback actif par exercice et par utilisateur,
- une nouvelle validation du meme exercice remplace l'entree precedente,
- les valeurs invalides sont ignorees a l'import,
- les feedbacks d'exercices supprimes du catalogue sont filtres.

## Rapport d'usabilite V1

Le rapport visible dans `Progression` expose:

- nombre total de feedbacks,
- moyenne de difficulte,
- moyenne de clarte,
- moyenne d'autonomie,
- exercices a surveiller:
  - difficulte forte,
  - clarte faible,
  - autonomie faible,
- dernier feedback saisi.

Le meme rapport est exporte en JSON dans:

- `Dossier utilisateur/ProgressionAtelier/rapport-usabilite.json`

Une version lisible humainement est aussi exportee dans:

- `Dossier utilisateur/ProgressionAtelier/rapport-usabilite.md`

## Heuristiques de calcul

Scores internes V1:

- difficulte
  - `easy` = 1
  - `adapted` = 2
  - `hard` = 3
- clarte
  - `unclear` = 1
  - `medium` = 2
  - `clear` = 3
- autonomie
  - `assisted` = 1
  - `partial` = 2
  - `independent` = 3

Interpretation:

- difficulte haute + clarte basse = friction probable de l'exercice,
- autonomie haute dans le temps = progression de l'utilisateur,
- clarte haute + difficulte adaptee = exercice pedagogiquement stable.

## Choix techniques

- implementation dans `packages/atelier-core` pour mutualiser Word, Excel et PowerPoint,
- conservation du flux de sauvegarde existant,
- enrichissement du modele plutot que creation d'un second fichier,
- rapport calcule cote client a partir du JSON de progression.

## Hors scope V1

- agregat multi-utilisateurs automatique,
- role ou page formateur separee,
- export consolide dossier par dossier,
- questionnaire differencie par type d'atelier.

## Suite probable

### V1.1

- filtre par theme dans le rapport.

### V2

- vue `Formateur` via serveur (voir [FEATURE_ESPACE_FORMATEUR.md](./FEATURE_ESPACE_FORMATEUR.md)),
- synthese croisee par utilisateur, exercice et theme sur API,
- plus de scan de dossiers utilisateurs locaux comme strategie cible.
