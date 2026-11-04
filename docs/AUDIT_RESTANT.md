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
3. **Publication** : generer `apps/*/app/` en CI et le sortir du versionnement Git (audit §1).
4. **Plus tard** : CSS commun dans `atelier-core`, reorganisation de la documentation (audit §8, §9).

Les assets passent avant la sortie de `app/` parce que chaque fichier supprime de `data/` disparait aussi de `app/`.

Question de suivi pour le prochain audit :

- "Les doublons d'assets et `apps/*/app/` sont-ils sortis du depot, et la CI bloque-t-elle un deploiement dont les tests echouent ?"

## Etat acquis (verifie le 2026-11-04)

- `docs/` contient de la documentation durable (exception : `Exercices Bureautique - todo.md`)
- `reports/` contient les inventaires et rapports regenerables
- `logs/` et `backups/` ne sont pas conserves dans le depot
- la validation detecte les fichiers orphelins a la racine de `app/`
- `validate:app-sync` est OK pour les 3 ateliers
- les scripts des apps sont des wrappers minces vers `atelier-core`

## Elements gardes intentionnellement

- `apps/*/data/assets/`
  - raison : contenu pedagogique distribue
  - cout : volume important du depot, aggrave par les doublons (voir chantier 2)

- `apps/*/app/`
  - raison : artefact publie encore versionne, en attendant le chantier 3
  - cout : duplication quasi complete de `data/`, `js/`, `styles` et `index`
  - tant que la migration n'est pas faite, ce dossier doit continuer a etre valide

- `apps/*/js/core/`
  - raison : copie du runtime `packages/atelier-core/browser/`, controlee par `runtime:validate`
  - a regenerer plutot que versionner une fois le chantier 3 fait

- `apps/*/releases/` et `pages/releases/`
  - raison : historique de release expose a l'utilisateur

- `package-lock.json` racine + apps
  - raison : reproductibilite par perimetre

## Elements encore a surveiller

- `apps/*/scripts/maintenance/*`
  - a garder tant que le flux de scraping/revision reste utile
  - a supprimer si un atelier abandonne definitivement ce flux
  - ce flux est a l'origine des paires `-image-*` / `-scrape-*` en double

- `styles-redesign-v2.css`
  - actuellement reference dans les `index.html`, donc a garder
  - forte divergence entre ateliers (audit §8)

- `README.txt` vs `app/README.txt`
  - duplication assumee
  - fonctions differentes : source de travail vs distribution
