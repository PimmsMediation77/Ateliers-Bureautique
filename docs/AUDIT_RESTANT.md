# Audit restant

Dernier audit structurel : **2026-11-04** → [AUDIT_STRUCTUREL_2026-11-04.md](AUDIT_STRUCTUREL_2026-11-04.md)
(audit precedent : 2026-07-15, dont ce fichier etait la synthese)

## Chantiers ouverts, par ordre de priorite

1. ~~**Rapide**~~ — fait le 2026-11-04 :
   - `deploy.yml` lance `core:test`, les tests des 3 ateliers (runtime + encodage + tests) et `validate:app-sync` avant de publier ; Node 22 requis pour les globs de `node --test`
   - scripts orphelins : 7 scripts de migration ponctuelle supprimes ; `assets:source-inventory`, `assets:verify-links` et `assets:drive-missing:xlsx` exposes
   - `downloads-assets-source/` ajoute au `.gitignore`
   - test PowerPoint instable : non reproduit sur 6 passages (echec probablement lie au travail en cours sur le core pendant l'audit)
2. ~~**Assets**~~ — fait le 2026-11-04 :
   - toutes les references pointent vers les dossiers numerotes ; les anciens dossiers (`m*`, `bases-<nom>`, `avance-<nom>`...) sont supprimes
   - doublons supprimes : copies non referencees, puis copies identiques a l'interieur d'un meme exercice (`-scrape-*` fusionne vers `-image-*`)
   - `data/assets/` : 2 476 → 1 362 fichiers, ~118 → ~75 Mo (gain identique dans `app/`)
   - `npm run assets:unused` produit `reports/assets-unused-report.{md,json}` ; `assets:verify-links` ne compare plus a l'instantane `assetUrl` de juillet (0 echec sur 2 119 liens)
   - `excel-ex-00{1,2,3}-g19{1,2,3}.xlsx` : la copie du dossier numerote etait en fait un doublon de `g188`-`g190` ; la vraie version (ancien dossier) a ete deplacee
   - reste a revoir a la main : 5 fichiers non references (voir `reports/assets-unused-report.md`) et 31 groupes de doublons partages entre exercices differents, gardes separes volontairement
3. ~~**Publication**~~ — fait le 2026-11-04 :
   - `apps/*/app/` est ignore par Git ; `deploy.yml` le genere (`npm run apps:sync`), verifie que la sync ne modifie aucune source, puis valide et publie
   - `sync:app` copie aussi `releases/` et `README-app.txt` (ex-`app/README.txt`) ; les releases n'ecrivent plus dans `app/`
   - controle d'encodage limite a `data/` (les copies `app/` sont verifiees par `validate:app-sync`)
   - verifie : le `app/` genere est identique octet pour octet a celui qui etait versionne (509 / 874 / 78 fichiers)
   - l'historique Git garde son poids (pas de reecriture)
4. **CSS commun** (audit §8) — extraction faite le 2026-11-04 :
   - l'ecart Word ↔ Excel de 1 664 lignes sur `styles-redesign-v2.css` venait surtout des fins de ligne (CRLF) ; l'ecart reel etait de ~160 lignes
   - `packages/atelier-core/browser/styles/{base,redesign}.css` (406 blocs communs aux 3 ateliers), copies en `apps/*/css/core/` par `sync:app` et chargees avant les feuilles de l'atelier
   - extraction mecanique, sans changement visuel : styles calcules de tous les elements identiques avant/apres sur 48 ecrans (7 a 9 routes par atelier, en largeur bureau et mobile), via Chrome headless
   - ecarts Word tranches le 2026-11-04 : mise en page Word (vignettes pleine largeur, introduction des etapes en texte normal) appliquee aux 3 ateliers ; onglets de variantes ajoutes a Word ; statut « fichier deja existant » (inactif depuis juin) supprime ; CSS inutilise retire
   - les `styles*.css` des ateliers ne contiennent plus que leur theme (couleurs, fond, en-tete)
5. ~~**Documentation**~~ — fait le 2026-11-04 (audit §9) :
   - `BACKLOG_GITHUB_ISSUES.md` → `docs/BACKLOG.md` ; la todo → `TODO.md` a la racine
   - docs Word au nom accentue regroupees et renommees dans `apps/word/docs/modernisation-2024/` (le backlog Word y reste : il fait partie de ce dossier)
   - fiches `FEATURE_*` laissees dans `packages/atelier-core/docs/` : elles documentent le core et pointent vers son code ; elles sont listees dans `ARCHITECTURE.md`
   - index de la documentation dans `README.md` ; liens absolus `C:/...` remplaces par des liens relatifs
   - `.cursor/rules/interpretation-enonces.mdc` renvoie a `AGENTS.md` au lieu de recopier la regle

Les assets passent avant la sortie de `app/` parce que chaque fichier supprime de `data/` disparait aussi de `app/`.

Question de suivi pour le prochain audit :

- "Les ecarts CSS restants entre ateliers ont-ils ete tranches, et `apps/*/js/core/` / `apps/*/css/core/` peuvent-ils a leur tour devenir generes ?"

## Etat acquis (verifie le 2026-11-04)

- `docs/` contient de la documentation durable (la todo est a la racine : `TODO.md`)
- `reports/` contient les inventaires et rapports regenerables
- `logs/` et `backups/` ne sont pas conserves dans le depot
- la validation detecte les fichiers orphelins a la racine de `app/`
- `validate:app-sync` est OK pour les 3 ateliers
- les scripts des apps sont des wrappers minces vers `atelier-core`

## Elements gardes intentionnellement

- `apps/*/data/assets/`
  - raison : contenu pedagogique distribue
  - cout : volume important du depot, aggrave par les doublons (voir chantier 2)

- `apps/*/js/core/`
  - raison : copie du runtime `packages/atelier-core/browser/`, controlee par `runtime:validate`
  - pourrait a son tour devenir genere (non versionne), comme `app/`

- `apps/*/releases/` et `pages/releases/`
  - raison : historique de release expose a l'utilisateur

- `package-lock.json` racine + apps
  - raison : reproductibilite par perimetre

## Elements encore a surveiller

- `apps/*/scripts/maintenance/*`
  - a garder tant que le flux de scraping/revision reste utile
  - a supprimer si un atelier abandonne definitivement ce flux
  - ce flux est a l'origine des paires `-image-*` / `-scrape-*` en double

- `styles.css` / `styles-redesign-v2.css` des ateliers
  - ne contiennent plus que les specificites ; la base est dans `packages/atelier-core/browser/styles/`
  - avant de mettre une regle en commun, verifier qu'elle ne change pas l'ordre de cascade face a une regle specifique

- `README.txt` vs `README-app.txt`
  - fonctions differentes : source de travail vs distribution (copie en `app/README.txt`)
