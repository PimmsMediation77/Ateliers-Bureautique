import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createConfiguredModelFactory } from "./model.contract.mjs";

function toList(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item.trim() : String(item?.src || item?.url || "").trim()))
      .filter(Boolean);
  }
  return [String(value).trim()].filter(Boolean);
}

function isLocalAssetPath(url) {
  const value = String(url || "").trim();
  if (!value) return false;
  if (/^https?:\/\//i.test(value)) return false;
  if (value.startsWith("data:")) return false;
  return true;
}

function collectDownloadUrls(exercise) {
  const urls = [];
  for (const key of ["docxUrl", "workFileUrl", "downloadUrl"]) {
    urls.push(...toList(exercise[key]));
  }
  for (const item of exercise.extraDownloadUrls || []) {
    if (typeof item === "string") urls.push(item.trim());
    else if (item && item.url) urls.push(String(item.url).trim());
  }
  return [...new Set(urls.filter(Boolean))];
}

function collectDeclaredVisualUrls(exercise) {
  return [...new Set([
    ...toList(exercise.imageEnonce),
    ...toList(exercise.imageResultat),
    ...toList(exercise.scrape?.enonceImages),
    ...toList(exercise.scrape?.resultImages),
    ...toList(exercise.scrape?.extraImages),
    ...toList(exercise.extraImages),
  ])];
}

function normalizeTextBlob(exercise) {
  return [
    exercise.description || "",
    exercise.preamble || "",
    ...(exercise.instructions || []),
    ...(exercise.consignes || []),
    ...(exercise.criteria || []),
    ...(exercise.originalInstructions || []),
    ...(exercise.originalConsignes || []),
  ]
    .join("\n")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

function stripDownloadNegations(text) {
  return String(text || "")
    .replace(/aucun fichier a telecharger/g, " ")
    .replace(/pas de fichier a telecharger/g, " ")
    .replace(/sans fichier a telecharger/g, " ")
    .replace(/ne comporte pas de fichier[^.!\n]*/g, " ")
    .replace(/aucun fichier de travail/g, " ")
    .replace(/plutot qu.a partir d.un fichier a telecharger/g, " ")
    .replace(/plutot que de telecharger/g, " ");
}

function requiresDownloadAsset(text) {
  if (/vous pouvez telecharger|si vous (le |la |les )?souhaitez.*telecharg|telechargement optionnel/.test(text)) {
    return false;
  }
  const cleaned = stripDownloadNegations(text);
  return (
    /telechargez (le |la |les |l'|un |une )?(fichier|zip|document|classeur|presentation|annexe|visuel|image|archive)/.test(cleaned)
    || /decompressez/.test(cleaned)
    || /ouvrez le fichier telecharge/.test(cleaned)
    || /fichier (de travail |fourni |a telecharger)/.test(cleaned)
    || /telechargez puis/.test(cleaned)
  );
}

function inventsDownloadWithoutAsset(text) {
  const cleaned = stripDownloadNegations(text);
  return (
    /ouvrez le fichier telecharge/.test(cleaned)
    || /dans (vos )?(documents|telechargements)/.test(cleaned)
    || /fichier telecharge/.test(cleaned)
  );
}

function localPathExists(appRoot, relativeUrl) {
  const cleaned = String(relativeUrl || "").split("?")[0].split("#")[0];
  return fs.existsSync(path.join(appRoot, cleaned));
}

/**
 * Exercices sans visuel de solution connu dans les sources actuelles.
 * Toute nouvelle entrée doit être justifiée ; l'objectif est de réduire cette liste.
 */
const KNOWN_MISSING_RESULT_VISUALS = {
  word: new Set(["ex-126", "ex-149"]),
  excel: new Set(),
  powerpoint: new Set(),
};

export async function registerExerciseIntegrityContractTests({
  appRoot,
  appKey,
  appLabel,
  modelGlobalName,
}) {
  const structuredPath = path.join(appRoot, "data", "exercises.structured.json");
  const raw = JSON.parse(fs.readFileSync(structuredPath, "utf8"));
  assert.ok(Array.isArray(raw.exercises), `${appLabel}: exercises.structured.json doit contenir exercises[]`);
  assert.ok(Array.isArray(raw.modules), `${appLabel}: exercises.structured.json doit contenir modules[]`);

  const createModel = await createConfiguredModelFactory({ appRoot, modelGlobalName });
  const model = createModel(raw);
  const knownMissing = KNOWN_MISSING_RESULT_VISUALS[appKey] || new Set();
  const seenIds = new Set();
  const seenIndexes = new Set();

  test(`${appLabel}: allowlist des visuels manquants reste valide`, () => {
    for (const id of knownMissing) {
      assert.ok(
        raw.exercises.some((exercise) => exercise.id === id),
        `${appLabel}: allowlist invalide, exercice inconnu ${id}`,
      );
    }
  });

  for (const rawExercise of raw.exercises) {
    const exerciseId = rawExercise.id;

    test(`${appLabel} ${exerciseId}: integrite exercice`, () => {
      assert.equal(typeof exerciseId, "string");
      assert.ok(exerciseId.trim(), "id requis");
      assert.equal(seenIds.has(exerciseId), false, `id duplique: ${exerciseId}`);
      seenIds.add(exerciseId);

      assert.ok(rawExercise.title && String(rawExercise.title).trim(), "title requis");
      assert.ok(rawExercise.moduleId, "moduleId requis");
      assert.ok(Number.isFinite(Number(rawExercise.globalIndex)), "globalIndex requis");
      assert.equal(
        seenIndexes.has(rawExercise.globalIndex),
        false,
        `globalIndex duplique: ${rawExercise.globalIndex}`,
      );
      seenIndexes.add(rawExercise.globalIndex);

      const hasSteps = toList(rawExercise.instructions).length > 0
        || toList(rawExercise.consignes).length > 0
        || toList(rawExercise.criteria).length > 0
        || toList(rawExercise.originalInstructions).length > 0
        || toList(rawExercise.originalConsignes).length > 0
        || String(rawExercise.preamble || "").trim().length > 0
        || String(rawExercise.description || "").trim().length > 0;
      assert.ok(hasSteps, "au moins une consigne, instruction, description ou preamble");

      const modelExercise = model.getExerciseById(exerciseId);
      assert.ok(modelExercise, "exercice charge dans le modele");

      const visuals = model.getVisualsForExercise(modelExercise);
      const displayedResult = toList(visuals.resultImages);
      const displayedEnonce = toList(visuals.enonceImages);

      const declaredResultat = toList(rawExercise.imageResultat);
      const declaredEnonce = toList(rawExercise.imageEnonce);
      const scrapeResult = toList(rawExercise.scrape?.resultImages);

      if (declaredResultat.length > 0) {
        assert.ok(
          displayedResult.length > 0,
          "imageResultat declaree mais aucun rendu attendu affiche (scrape.resultImages vide ?)",
        );
        for (const src of declaredResultat) {
          assert.ok(
            displayedResult.includes(src) || scrapeResult.includes(src) || scrapeResult.length > 0,
            `imageResultat non exposee: ${src}`,
          );
        }
      }

      if (declaredEnonce.length > 0 && declaredResultat.length === 0) {
        assert.ok(
          displayedResult.length > 0 || displayedEnonce.length > 0,
          "imageEnonce unique doit produire un visuel (resultat ou enonce)",
        );
        assert.ok(
          displayedResult.length > 0,
          "regle metier: image unique => rendu attendu",
        );
      }

      if (Array.isArray(rawExercise.scrape?.resultImages) && rawExercise.scrape.resultImages.length === 0) {
        assert.equal(
          declaredResultat.length,
          0,
          "scrape.resultImages [] ne doit pas cohabiter avec imageResultat (masque le rendu attendu)",
        );
      }

      const hasAnyDeclaredVisual = collectDeclaredVisualUrls(rawExercise).length > 0;
      if (!knownMissing.has(exerciseId)) {
        assert.ok(
          displayedResult.length > 0 || hasAnyDeclaredVisual === false,
          "rendu attendu manquant alors qu'un visuel est declare",
        );
        if (!hasAnyDeclaredVisual) {
          assert.fail("aucun visuel de solution declare (imageResultat/imageEnonce/scrape)");
        }
        assert.ok(displayedResult.length > 0, "aucun rendu attendu affiche");
      } else {
        assert.equal(
          displayedResult.length + collectDeclaredVisualUrls(rawExercise).length,
          0,
          "exercice allowliste mais un visuel existe deja: retirer de l'allowlist",
        );
      }

      for (const url of collectDeclaredVisualUrls(rawExercise)) {
        if (!isLocalAssetPath(url)) continue;
        assert.ok(localPathExists(appRoot, url), `fichier visuel manquant: ${url}`);
      }

      const downloadUrls = collectDownloadUrls(rawExercise);
      for (const url of downloadUrls) {
        if (!isLocalAssetPath(url)) continue;
        assert.ok(localPathExists(appRoot, url), `fichier a telecharger manquant: ${url}`);
      }

      const text = normalizeTextBlob(rawExercise);
      if (requiresDownloadAsset(text)) {
        assert.ok(
          downloadUrls.length > 0,
          "les consignes exigent un telechargement mais aucun docxUrl/downloadUrl n'est renseigne",
        );
      }
      if (downloadUrls.length === 0 && inventsDownloadWithoutAsset(text)) {
        assert.fail("consignes qui supposent un fichier telecharge alors qu'aucun asset n'est lie");
      }
    });
  }
}
