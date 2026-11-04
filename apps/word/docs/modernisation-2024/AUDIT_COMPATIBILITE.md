# Audit de compatibilité - Clic Formation Word

## Référence

- Version cible : Microsoft Word LTSC 2024 / Microsoft 365
- Date d'audit : 2026-07-06
- Périmètre : modules `W01` à `W23`
- Volume estimé : `213` exercices

---

## Synthèse générale

Le contenu pédagogique reste très largement exploitable avec Word LTSC 2024 et Microsoft 365.

Les fonctions fondamentales de Word sont toujours présentes :

- saisie et mise en forme
- paragraphes
- tabulations
- tableaux
- images
- sections
- en-têtes et pieds de page
- objets
- SmartArt

Les écarts constatés concernent surtout :

- l'apparence de l'interface ;
- les styles graphiques ;
- certaines galeries prédéfinies ;
- quelques captures d'écran devenues anciennes.

Les incompatibilités réelles sont peu nombreuses.

## Taux de compatibilité estimé

`≈ 95 %`

## Répartition globale estimée

| État | Nombre estimé |
|------|--------------:|
| Compatible | ~185 |
| À adapter | ~23 |
| Résultat différent | ~3 |
| Obsolète | ~2 |

---

## Points critiques

### Fonctionnalités supprimées

#### 1. Remplissage d'un WordArt par une image

- État : supprimé
- Impact : très fort
- Exercice concerné confirmé : `W17 Exercice 2`
- Action : remplacer l'exercice par une variante compatible

#### 2. ClipArt Microsoft

- État : supprimé
- Impact : moyen
- Modules concernés : principalement `W12`, potentiellement d'autres exercices avancés
- Remplacement conseillé :
  - icônes
  - images SVG
  - banque d'images Microsoft
  - images libres de droits

### Fonctionnalités ayant évolué

| Fonction | Impact |
|----------|--------|
| Styles WordArt | Moyen |
| Galerie WordArt | Moyen |
| Styles SmartArt | Faible |
| Styles d'image | Faible |
| Ombres | Faible |
| Dégradés | Faible |
| Thèmes Office | Faible |
| Volet Navigation | Faible |

---

## Priorités de mise à jour

| Module | Priorité | Motif principal |
|--------|---------:|-----------------|
| W17 - WordArt | 5/5 | obsolescence réelle de certains exercices |
| W12 - Images | 3/5 | disparition des ClipArt, styles d'image modernisés |
| W18 - Formes | 2/5 | styles et effets modernisés |
| W21 - SmartArt | 2/5 | styles et aperçus différents |
| W22 - Dessins | 1/5 | différences surtout visuelles |

---

## Détail par lots

## Lot 1 - Modules 1 à 5

| Module | Exercices | Compatibilité |
|--------|----------:|---------------|
| 1 - Prise en main | 3 | Compatible |
| 2 - Gérer les documents | 2 | Compatible |
| 3 - Saisir du texte | 10 | Compatible |
| 4 - Options paragraphe | 6 | Compatible |
| 5 - Puces et numéros | 8 | Compatible |

### Bilan

- Compatibles : `29`
- Menus déplacés : `0`
- Résultat différent : `0`
- Obsolètes : `0`

### Conclusion

Les modules `1` à `5` sont entièrement compatibles. Aucune adaptation nécessaire.

---

## Lot 2 - Modules 6 à 10

| Module | Exercices | Compatibilité |
|--------|----------:|---------------|
| 6 - Bordures et trames | 8 | Compatible |
| 7 - Mise en forme des caractères | 7 | Compatible |
| 8 - Reproduire la mise en forme | 5 | Compatible |
| 9 - Rechercher / Remplacer | 6 | Compatible |
| 10 - Les tabulations | 10 | Compatible |

### Bilan

- Compatibles : `36`
- Menus modernisés : `2`
- Résultat différent : `0`
- Obsolètes : `0`

### Remarques

- Le volet de navigation est plus moderne.
- Les palettes de couleurs utilisent les thèmes Office récents.

### Conclusion

Les modules `6` à `10` sont exploitables sans modification des exercices. Quelques captures d'écran peuvent être modernisées.

---

## Lot 3 - Modules 11 à 15

| Module | Exercices | Compatibilité |
|--------|----------:|---------------|
| W11 - Sections et sauts | 4 | Compatible |
| W12 - Insérer une image | 10 | Compatible avec adaptations |
| W13 - En-têtes et pieds de page | 4 | Compatible |
| W14 - Tableaux (bases) | 9 | Compatible |
| W15 - Tableaux (mise en forme) | 7 | Compatible |

### Bilan

- Compatibles : `21`
- À adapter : `13`
- Résultat différent : `0`
- Obsolètes : `0`

### Point de vigilance

`W12` est le premier module où apparaissent de vraies évolutions :

- habillage : icônes changées
- styles d'image : rendu proche mais différent
- effets artistiques : rendu parfois légèrement différent
- ClipArt : supprimés

### Conclusion

Les modules `11` à `15` restent largement compatibles. Le seul vrai point sensible est la disparition des ClipArt Microsoft.

---

## Lot 4 - Modules 16 à 20

| Module | Exercices | Compatibilité |
|--------|----------:|---------------|
| W16 - Objets | 9 | Compatible |
| W17 - WordArt | 5 | Partiellement obsolète |
| W18 - Formes | 10 | Compatible avec adaptations |
| W19 - Mise en page | 9 | Compatible avec adaptations |
| W20 - Affichage | 6 | Compatible avec adaptations |

### Bilan

- Compatibles : `24`
- À adapter : `10`
- Résultat différent : `2`
- Obsolètes : `3`

### Point critique : W17 - WordArt

| Exercice | État | Commentaire |
|----------|------|-------------|
| 1 | Compatible | création simple toujours possible |
| 2 | Obsolète | remplissage du texte par image supprimé |
| 3 | Résultat différent | styles WordArt modernes différents |
| 4 | Résultat différent | ombres, reliefs et biseaux redessinés |
| 5 | Obsolète / à revoir | modèle ancien difficile à reproduire fidèlement |

### Conclusion

`W17` est le premier module réellement obsolète de la formation. Les autres modules du lot restent exploitables avec des écarts surtout visuels.

---

## Lot 5 - Modules 21 à 23

| Module | Exercices | Compatibilité |
|--------|----------:|---------------|
| W21 - SmartArt | 10 | Compatible avec adaptations |
| W22 - Dessins et objets graphiques | 10 | Compatible avec adaptations |
| W23 - Exercices avancés | 11 | Variable selon les techniques utilisées |

### Bilan

- Compatibles : `17`
- À adapter : `11`
- Résultat différent : `3`
- Obsolètes : `0`

### Remarques

- SmartArt toujours présent, mais styles et aperçus modernisés.
- Objets graphiques toujours faisables, avec thèmes et effets plus récents.
- `W23` dépend fortement des techniques mobilisées dans chaque composition.

### Conclusion

Les modules `21` à `23` restent compatibles. Les adaptations relèvent surtout de la mise à jour visuelle des supports.

---

## Exercices prioritaires

### À refaire

- `W17 - Exercice 2`

### À adapter

- `W17 - Exercice 3`
- `W17 - Exercice 4`
- `W17 - Exercice 5`

### À vérifier

- tous les exercices utilisant des ClipArt ;
- tous les exercices reposant sur d'anciens styles WordArt ;
- les captures d'écran Office 2010 encore présentes dans les supports.

---

## Conclusion générale

La formation Word reste remarquablement actuelle malgré son ancienneté.

La modernisation nécessaire porte principalement sur :

- la mise à jour des captures d'écran ;
- l'adaptation du module `W17 - WordArt` ;
- le remplacement des références aux ClipArt Microsoft.

En dehors de ces points, les exercices peuvent être réutilisés presque tels quels avec Word LTSC 2024 et Microsoft 365.
