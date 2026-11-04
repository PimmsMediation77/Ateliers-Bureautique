# Visionneuse d'images

Les apprenants travaillent presque toujours dans Chrome, l'écran (souvent 1440×900) partagé en deux : l'appli d'un côté, le fichier Word, Excel ou PowerPoint de l'autre. L'appli dispose donc d'environ 720 px de large. La visionneuse est pensée pour ce cas : elle occupe toute la fenêtre de l'appli, jamais l'écran entier, et peut se détacher dans une petite fenêtre qui reste au-dessus d'Office.

## Ce que voit l'apprenant

Un clic sur une vignette (énoncé, résultat attendu, images illustratives) ouvre un **panneau** sur toute la fenêtre de l'appli :

- bandeau : « ← Retour à l'exercice », « ⧉ Détacher », onglets entre les groupes d'images (affichés s'il y en a au moins deux) ;
- rappel de l'**étape en cours** avec ‹ › ;
- légende de l'image et navigation ‹ 1 / 3 › entre les images du groupe ;
- l'image :
  - un clic zoome à l'endroit cliqué, un second clic revient à la largeur ;
  - on glisse pour se déplacer ;
  - molette : défilement ; Ctrl + molette ou pincement : zoom sous le pointeur ;
- barre d'outils toujours visible : −, pourcentage, +, Largeur, Page entière ;
- clavier : Échap (fermer), ← → (image), + − 0 (zoom).

**Détacher** ouvre l'image dans une fenêtre flottante (Document Picture-in-Picture, Chrome et Edge 116+), toujours au premier plan, que l'apprenant pose sur Office :

- un clic sur une autre vignette, un changement d'onglet ou d'exercice met à jour la fenêtre ;
- « Ramener dans l'appli » la remet dans le panneau ; la fermer (✕) range la visionneuse ;
- si le navigateur ne propose pas la fonction ou refuse la fenêtre, le bouton reste masqué.

**Étape en cours** : un clic sur une étape de la liste la met en surbrillance (`.is-current-step`, `aria-current="step"`) ; le rappel du panneau et de la fenêtre flottante affiche cette étape, et ‹ › met la liste à jour. L'étape repart de 1 à chaque ouverture d'un exercice et à chaque changement d'onglet (`exerciseTabs`). Un clic sur un bouton (« Détails ») ou une sélection de texte (bloc à copier) ne change pas l'étape.

## Où vit le code

- `browser/view.js` :
  - `#renderImageGroup` / `#renderExtraImages` remplissent `imageGalleries` (`enonce`, `result`, `extra`) ;
  - `openImageModal(cléGalerie, index, vignette)` et `closeImageModal()` ;
  - zoom : `viewerZoom`, `#zoomViewerAt` (ancré sur un point), `#clampViewer`, gestes pointeur et molette ;
  - étape en cours : `modalStepIndex`, `#setModalStep`, `#renderModalStep`, `#highlightCurrentStep` ;
  - fenêtre flottante : `#detachImageViewer`, `#attachImageViewer`, `#refreshDetachedViewer` ; l'élément `#image-modal` est déplacé dans la fenêtre puis ramené à sa place, avec les feuilles de style copiées.
- `apps/*/index.html` : balisage `#image-modal.image-viewer` (les identifiants `image-modal-*` sont conservés).
- `apps/*/styles.css` : bloc « Visionneuse d'images » (classes `.image-viewer-*`, `.is-detached`, `#exercise-steps > li.is-current-step`), basé sur les variables de thème `--accent`, `--accent-soft`, `--panel`, `--line`.

Après modification : `npm run apps:sync` à la racine, puis `npm run runtime:validate`.

## Historique

Les tentatives précédentes et leurs défauts, à ne pas reproduire :

| Période | Approche | Défaut |
|---|---|---|
| juin 2026 | Modale plein écran, zoom molette | Masquait les consignes ; zooms involontaires à la molette |
| juillet 2026 (`0a407d0`) | Visionneuse dans le bloc images | Étapes hors écran ; défilements imbriqués |
| octobre 2026 (`edcd708`, `155b4c8`) | Bouton « Dézoomer », pan à la main | Zoom depuis le coin haut gauche ; « Dézoomer » fermait la visionneuse ; zoom invisible (double-clic, + −) |

La version actuelle (novembre 2026) a été choisie à partir d'une maquette qui comparait trois variantes en écran partagé simulé.

## Évolution prévue : zone d'image par étape (non implémentée)

**But** : quand l'apprenant passe à une étape, la visionneuse va d'elle-même à la bonne image et zoome sur la zone concernée. Exemple : sur ex-204, « Ajoutez le pied de page » cadre le bas de la page 1 du résultat attendu. C'est le principe des tutoriels en captures recadrées (Scribe, Tango) : montrer le détail utile plutôt que la page entière.

### Données proposées

Comme `stepHelp`, une table par exercice, indexée par le **libellé** de l'étape (texte avant « : », casse ignorée). Pour les étapes sans libellé, la clé est le numéro de l'étape (`"3"`).

```json
"stepImages": {
  "Pied de page": { "gallery": "result", "image": 0, "zone": [5, 88, 90, 10] },
  "3": { "gallery": "enonce", "image": 0 }
}
```

- `gallery` : `enonce`, `result` ou `extra` ;
- `image` : index dans la galerie (0 par défaut) ;
- `zone` (facultative) : `[x, y, largeur, hauteur]` en **pourcentage** de l'image, donc indépendante de sa résolution ; sans zone, la visionneuse affiche l'image en largeur.

Les étapes des onglets (`exerciseTabs`) peuvent porter leur propre `stepImages`.

### Comportement

- Changer d'étape (liste, ‹ › du panneau ou de la fenêtre flottante) alors que la visionneuse est ouverte : changement d'image si besoin, puis cadrage de la zone (échelle telle que la zone tienne dans la scène, centrée), avec une transition courte (aucune si `prefers-reduced-motion`).
- Ouvrir la visionneuse depuis une vignette garde le comportement actuel : l'image cliquée, en largeur.
- Un repère discret indique que le cadrage vient de l'étape (« Zoom sur l'étape 4 ») ; les boutons Largeur et Page entière permettent toujours de voir toute la page.
- Une étape sans entrée dans `stepImages` ne déplace rien.

### Travail à prévoir

1. **Modèle** (`browser/model.js`) : `normalizeStepImages`, résolution libellé ou numéro → entrée, sur le modèle de `normalizeStepHelp`.
2. **Vue** (`browser/view.js`) : dans `#setModalStep`, appliquer l'entrée de l'étape ; ajouter `#zoomViewerToZone(zone)` en réutilisant `#zoomViewerAt` et `#clampViewer`.
3. **Test d'intégrité** : galerie et index existants, zone comprise entre 0 et 100, libellé ou numéro correspondant à une étape.
4. **Outil de saisie des zones** : sans outil, relever des pourcentages à la main est fastidieux. Proposition : en mode formateur, Alt + glisser sur l'image trace un rectangle et copie l'entrée JSON correspondante.
5. **Pilote** : deux ou trois exercices denses (par exemple Word ex-204 et un exercice Excel à tableau), puis observation en atelier avant de généraliser.

L'essentiel du coût est dans le contenu (une zone par étape utile), pas dans le code.
