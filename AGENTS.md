## Commandes shell

- Utiliser `bash` par defaut pour les commandes shell.
- Ne pas utiliser PowerShell sauf s'il n'existe pas d'alternative raisonnable.
- Si PowerShell est necessaire, expliquer brievement pourquoi.

## Environnement local

- Les commandes shell doivent fonctionner avec Git Bash disponible dans le `PATH`.

## Git

- Quand l'utilisateur demande `do commit`, faire un commit cible sur les fichiers de la correction en cours.
- Utiliser `npm run do:commit -- "type(scope): description" [fichier...]` quand c'est pertinent.
- Ne pas inclure des changements non lies a la correction demandee.

## Interpretation des enonces / consignes

- Lire le sens de l'enonce source (page clic-formation ou equivalent) avant d'ajouter un fichier a telecharger.
- Un exercice n'a **pas toujours** besoin de `docxUrl` / `downloadUrl`.
- **Sans fichier** quand l'enonce demande de creer depuis zero (document vierge, dossiers, formes, saisie, personnalisation UI, etc.).
  Exemple : https://www.clic-formation.net/gerer-les-documents-dans-word/exercice-1.html
  (creer `Europe` / `france`, puis enregistrer un document en `.docx`, `.doc` et `.pdf`).
- **Avec fichier** seulement si l'enonce fournit explicitement un document, une image, un zip ou des donnees de depart.
- Ne pas inventer de consignes du type "ouvrez le fichier telecharge" / "Documents ou Telechargements" si aucun asset n'est requis.
- Si seuls des images / zip d'images sont fournis (pas de `.docx` / `.xlsx` / `.pptx`), la 1re etape doit faire creer un document vierge :
  `Nouveau document : ouvrez Word et créez un document vierge.` (Excel : `Nouveau classeur : ...`, PowerPoint : presentation vierge).
  Le message "Activer la modification (bandeau jaune)" n'est affiche que si un fichier Office est propose (`packages/atelier-core/browser/view.js`).
- Distinguer telechargement **obligatoire** (asset lie) et mention **optionnelle** ("vous pouvez telecharger le texte") : dans ce second cas, laisser l'asset vide et orienter vers la saisie ou le modele image.
