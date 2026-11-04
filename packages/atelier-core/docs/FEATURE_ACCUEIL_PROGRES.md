# Feature : accueil module graphique et page « Mes progrès »

> Statut : validée et implémentée le 2026-11-04.
> Concerne `packages/atelier-core`, donc Word, Excel et PowerPoint.

## Objectif

- Rendre l'écran d'accueil module (`#home`) plus visuel, sans revenir sur la carte d'action unique (fil « vous êtes ici », un titre, un bouton).
- Donner à l'apprenant un accès direct et visible à ses statistiques, aujourd'hui rangées dans la page Profil.

## Constat (état actuel)

- Sous la carte d'accueil, la progression globale tient en une ligne de texte : « 18 exercices terminés sur 42 · Palier : Pratique ». Les 5 paliers ne sont jamais montrés.
- Les statistiques (terminés, taux, série, palier, courbe 30 jours, rapport QCM) sont dans `#page-profile`. On n'y accède que par le menu utilisateur ▾ → « Profil ».
- Elles sont affichées à côté des boutons « Réinitialiser progression » et « Réinitialiser profil local ».
- `model.getThemeProgressRows()` calcule l'avancement par thème, mais n'est utilisé nulle part.
- Le « Rapport d'usabilite » est en fait l'auto-évaluation de l'apprenant (QCM de fin d'exercice, voir [FEATURE_QCM_USABILITE.md](./FEATURE_QCM_USABILITE.md)), mais il est formulé pour un formateur.

## Intitulés retenus

- Bouton et entrée de menu : **📊 Voir mes progrès** (menu : « 📊 Mes progrès »).
- Titre de la page : **Où j'en suis**.
- Écartés : « Voir mon auto-évaluation » (long, scolaire), « Mon bilan » (évoque un examen).

## 1. Accueil module : bandeau de progression

La carte d'action reste inchangée. La ligne de texte placée dessous (`#home-progress-line`) est remplacée par un bandeau visuel :

```
┌──────────┐  Palier : Pratique
│   43 %   │  Démarrage ─ Lancement ─ [Pratique] ─ Autonomie ─ Maîtrise
│ (anneau) │  18 exercices terminés sur 42 · 🔥 3 jours d'affilée
└──────────┘  [ 📊 Voir mes progrès ]
```

- **Anneau de progression** en SVG inline, sans bibliothèque : pourcentage global (`summary.percent`). Ce n'est pas un doublon du fil, qui ne couvre que le thème en cours.
- **Échelle des 5 paliers** (`getLevelLabel`) : le palier atteint est mis en évidence et les paliers suivants sont grisés.
- **Série de jours** (`summary.streak`), affichée seulement si elle vaut au moins 1.
- **Bouton secondaire** « 📊 Voir mes progrès » qui mène à `#progress`.

Écarté pour l'instant : une rangée de tuiles par catégorie (icône + mini-barre). Elle réintroduirait une seconde navigation, alors que la refonte du 2026-11-03 a supprimé la colonne « Accès rapide ».

## 2. Nouvelle page `#progress` : « Où j'en suis »

Les sections, de haut en bas :

1. **Synthèse** : le même anneau, les paliers et la série que sur l'accueil.
2. **Mes thèmes** : une barre par thème, alimentée par `getThemeProgressRows()` (« Mise en forme ▓▓▓░░ 3/7 »). Un clic sur un thème ouvre ce thème.
3. **Mon activité** : la courbe sur 30 jours existante (`#progress-curve`), déplacée depuis Profil.
4. **Mon ressenti** : l'ancien « Rapport d'usabilite », reformulé pour l'apprenant. On affiche des compteurs en clair (« Faits en autonomie : 12 », « Trouvés difficiles : 4 ») avec des pictos, à la place des moyennes « 2,3/3 ».

La page **Profil** ne garde que l'utilisateur, le dossier de sauvegarde, les réinitialisations et les conseils.

## 3. Points d'accès à « Mes progrès »

| Où | Quand | Statut |
|---|---|---|
| Accueil module, bandeau de progression | Toujours | Retenu |
| Menu utilisateur ▾ → « 📊 Mes progrès » (1re entrée) | Partout, y compris pendant un exercice | Retenu |
| Notification (toast) après la validation d'un exercice (QCM rempli) | Fin d'exercice | Retenu |
| Lien « Voir mes progrès » dans la page Profil | Profil | Retenu |
| Étiquette et jauge du thème en haut de l'exercice (`#exercise-theme-progress`), cliquables | Pendant l'exercice | Non retenu pour l'instant |
| Bouton permanent dans la barre Précédent / Suivant | Pendant l'exercice | Écarté (distrait de la consigne) |

Notification de fin d'exercice, en bas à droite, fermée automatiquement après 10 s :

```
✓  Exercice 12 terminé                     📊 Voir mes progrès   ×
   Palier : Pratique · 43 % de l'atelier
```

Pourquoi un toast plutôt qu'un encart dans la page : le bouton « Marquer comme fait » est masqué, on valide en pratique avec « Suivant », qui enchaîne le QCM puis ouvre l'exercice suivant. Un encart placé dans la page disparaîtrait aussitôt, alors que le toast reste visible sur l'exercice suivant.

## Où vit le code

- `browser/model.js` : `getLevelSteps()` (paliers et seuils, utilisés par `getLevelLabel`), `getThemeProgressRows()` (avec `affinityId`), `getUsabilityReport().counts` (répartition des réponses, également exportée dans le rapport formateur).
- `browser/home.js` : ajoute `levels` au view-model de l'accueil.
- `browser/progress.js` : runtime de la page `#progress` (`showPage("progress")`).
- `browser/controller.js` : route `progress` → page dédiée, route `profile` → profil seul, `showCompletionToast` après la validation d'un exercice.
- `browser/ui-events.js` : entrée de menu `header-user-progress-btn`.
- `browser/view.js` : `renderProgressRing`, `renderLevelScale`, `formatProgressLine`, `renderThemeProgress`, `renderUsabilityReport` (« Mon ressenti »), `showCompletionToast`.
- `scripts/sync-app-html.mjs` : gabarits du bandeau d'accueil, de `section#page-progress`, du profil allégé et de l'entrée de menu.
- `apps/*/styles.css` : bloc « Progression graphique » (mêmes règles, couleurs via `--accent` et `--ok` de chaque app).
- Après modification : `npm run sync:app` dans chaque app.

## Questions ouvertes

- **Mon ressenti** : affiché à l'apprenant, reformulé. Le JSON exporté pour le formateur ne change pas, à part l'ajout de `counts`. À confirmer avec les formateurs.
- **Tuiles par catégorie** sur l'accueil : à réévaluer après la mise en service.
- **Jauge du thème cliquable** dans l'exercice : non implémentée.
