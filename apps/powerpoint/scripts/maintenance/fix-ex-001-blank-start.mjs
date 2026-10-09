/**
 * Corrige powerpoint-ex-001 :
 * - pas de fichier de travail (docxUrl)
 * - point de départ sans images
 * - toutes les images dans résultat attendu
 * - consignes : PPT vierge + modèle PDF (aperçus) non modifiable
 *
 * Usage : node scripts/maintenance/fix-ex-001-blank-start.mjs
 * puis : npm run build:data && npm run sync:app
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");
const structuredFile = path.join(root, "data/exercises.structured.json");

const newPreamble =
  "Aucun fichier de travail a telecharger : partez d'une presentation PowerPoint vierge. " +
  "Le modele de reference est un PDF non modifiable ; ses apercus (toutes les diapositives) " +
  "sont dans le bloc Resultat attendu. Les visuels a inserer sont disponibles en ZIP.";

const newInstructions = [
  "Ouvrez PowerPoint et creez une nouvelle presentation vierge (Fichier > Nouveau).",
  "Consultez le modele de reference (PDF / apercus) dans le bloc Resultat attendu pour reproduire la structure et la mise en forme.",
  "Telechargez le ZIP des visuels, decompressez-le, puis utilisez ces images pour les insertions demandees.",
  "Diapositive 1 : inserez une image simple et ajustez sa taille pour obtenir un rendu propre.",
  "Diapositive 2 : creez un titre en WordArt et une zone de texte avec une liste a puces.",
  "Diapositive 3 : ajoutez un titre avec fond de couleur, plusieurs images et une fleche. Alignez les images du haut par le bas.",
  "Diapositive 4 : realisez le graphique simple si vous avez quelques notions Excel, sinon passez a la suite.",
  "Diapositive 5 : appliquez une police originale au titre puis construisez un tableau avec alternance de couleurs sur les lignes.",
  "Comparez votre diaporama aux apercus du Resultat attendu puis enregistrez avant de marquer l'exercice comme termine.",
];

const diapo1 = {
  src: "data/assets/powerpoint/bases-01-diaporamas/powerpoint-ex-001-scrape-enonce-1.jpg",
  caption: "Diapositive 1",
};

const data = JSON.parse(fs.readFileSync(structuredFile, "utf8"));
const ex = data.exercises.find((e) => e.id === "powerpoint-ex-001");
if (!ex) throw new Error("powerpoint-ex-001 introuvable");

const previousResults = ex.scrape?.resultImages ?? [];
const rest = previousResults.filter((img) => img.src !== diapo1.src);

ex.docxUrl = null;
ex.imageEnonce = null;
if (!ex.scrape) ex.scrape = {};
ex.scrape.enonceImages = [];
ex.scrape.resultImages = [diapo1, ...rest];
ex.preamble = newPreamble;
ex.instructions = [...newInstructions];
ex.consignes = [...newInstructions];
ex.extraImages = [];
data.generatedAt = new Date().toISOString();

fs.writeFileSync(structuredFile, `${JSON.stringify(data, null, 2)}\n`);
console.log("OK", structuredFile);

const revisionPath = path.join(root, "docs/REVISION_COHERENCE_EXERCICES.md");
if (fs.existsSync(revisionPath)) {
  let md = fs.readFileSync(revisionPath, "utf8");
  md = md.replace(
    /\| `powerpoint-ex-001` \| exercice-ppt-1 \|[^|]+\|[^|]+\|/,
    "| `powerpoint-ex-001` | exercice-ppt-1 | PPT vierge (pas de fichier de travail) ; modele PDF/apercus en resultat ; `visuels.zip` | OK (corrige 2026-10-09) |"
  );
  const note =
    "- `powerpoint-ex-001` : retrait du fichier de travail PPT (`docxUrl`) ; " +
    "modele = PDF/apercus non modifiables tous dans **Resultat attendu** ; " +
    "point de depart vide ; demarrage sur presentation vierge.";
  if (!md.includes("powerpoint-ex-001` : retrait du fichier de travail PPT")) {
    md = md.trimEnd() + `\n${note}\n`;
  }
  fs.writeFileSync(revisionPath, md);
  console.log("OK", revisionPath);
}
