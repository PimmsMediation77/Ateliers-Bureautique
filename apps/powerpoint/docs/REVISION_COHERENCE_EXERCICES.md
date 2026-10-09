# Revision coherence - Atelier PowerPoint

Date: 2026-10-09

## Regles appliquees

- Interpretation des enonces (`AGENTS.md` / `.cursor/rules/interpretation-enonces.mdc`) :
  - asset seulement si la source fournit explicitement un fichier de demarrage / zip / medias ;
  - pas de consignes qui inventent un telechargement sans asset ;
  - creation depuis zero => pas de `docxUrl` (ne pas servir une "Solution" comme fichier de travail).
- Non-regression runtime : contrat d'integrite
  (`packages/atelier-core/tests/shared/exercise-integrity.contract.mjs`)
  + `npm --prefix apps/powerpoint test`.

## Passage module (sources clic-formation)

| Exercice | Source | Fichiers attendus | Statut |
| --- | --- | --- | --- |
| `powerpoint-ex-001` | exercice-ppt-1 | PPT vierge (pas de fichier de travail) ; modele PDF/apercus en resultat ; `visuels.zip` | OK (corrige 2026-10-09) |
| `powerpoint-ex-002` | exercice-ppt-2 | modele PPTX + `visuels.zip` | OK |
| `powerpoint-ex-003` | exercice-ppt-3 | modele PPTX seul | OK |
| `powerpoint-ex-005` | exercice-ppt-5 | modele PPTX + `medias.zip` | OK |
| `powerpoint-ex-006` | exercice-ppt-6 | creation depuis zero (lien source = Solution) | OK (`docxUrl` retire) |
| `powerpoint-ex-007` | exercice-ppt-7 | modele PPTX + `medias.zip` | OK |

## Corrections 2026-10-09

- Ajout des ZIP manquants : visuels/medias pour 001, 002, 005, 007.
- Alignement des consignes sur les assets reels (decompresser avant usage).
- `powerpoint-ex-006` : retrait du fichier de travail (solution source, pas demarrage).
- `powerpoint-ex-001` : retrait du fichier de travail PPT (`docxUrl`) ; modele = PDF/apercus non modifiables tous dans **Resultat attendu** ; point de depart vide ; demarrage sur presentation vierge.
