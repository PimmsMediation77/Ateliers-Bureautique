# Fiches d'aide « Détails »

Une étape d'exercice peut afficher un bouton **Détails** qui ouvre une fenêtre d'aide (fiche) : texte d'introduction, liste numérotée, images et lien vers la source. Les fiches sont déclarées une seule fois et réutilisables par tous les exercices d'une app.

## Déclarer une fiche

À la racine de `apps/<app>/data/exercises.structured.json`, à côté de `modules` et `exercises` :

```json
"helpTopics": {
  "excel-formulaire": {
    "title": "Afficher le bouton Formulaire",
    "intro": "Texte d'introduction (facultatif).",
    "steps": ["Repère 1", "Repère 2"],
    "images": [
      { "src": "data/assets/excel/.../capture.webp", "caption": "Légende (facultative)" }
    ],
    "sourceUrl": "https://www.clic-formation.net/..."
  }
}
```

Seul `title` est obligatoire. Les images locales doivent exister dans `data/assets/` : le test d'intégrité le vérifie.

## Relier une étape à une fiche

Dans l'exercice, `stepHelp` associe le **libellé** de l'étape (texte avant « : ») à l'identifiant de la fiche :

```json
"instructions": ["Bouton Formulaire : il n'est pas affiché par défaut..."],
"stepHelp": { "Bouton Formulaire": "excel-formulaire" }
```

La comparaison ignore la casse. Les étapes des onglets (`exerciseTabs`) sont aussi concernées. Le test d'intégrité échoue si la fiche n'existe pas ou si aucun libellé d'étape ne correspond.

## Où vit le code

- `browser/model.js` : `normalizeHelpTopics`, `normalizeStepHelp`, `getStepHelpForExercise()`
- `browser/exercise.js` : passe `exercise.stepHelp` (fiches résolues) au view-model
- `browser/view.js` : bouton `.step-help-btn`, fenêtre `.help-modal` créée à la demande (fermeture par le bouton, un clic sur le fond ou Échap ; un clic sur une image l'agrandit)
- `apps/*/styles.css` : styles `.step-help-btn` et `.help-modal-*`

Après modification des données : `npm run build:data` puis `npm run sync:app` dans l'app.
