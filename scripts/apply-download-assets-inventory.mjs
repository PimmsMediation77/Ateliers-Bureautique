import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const INVENTORY_PATH = path.join(ROOT, "reports", "download-assets-inventory.json");

const APPS = [
  {
    app: "word",
    sourcePath: path.join(ROOT, "apps", "word", "data", "exercises.structured.json"),
  },
  {
    app: "excel",
    sourcePath: path.join(ROOT, "apps", "excel", "data", "exercises.structured.json"),
  },
  {
    app: "powerpoint",
    sourcePath: path.join(ROOT, "apps", "powerpoint", "data", "exercises.structured.json"),
  },
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function normalizeAssetUrl(baseAssetUrl, assetUrl, assetRelativePath) {
  const explicit = String(assetUrl || "").trim();
  if (/^https?:\/\//i.test(explicit)) return explicit;
  // Chemins relatifs GitHub Pages (ex. data/assets/word/.../fichier.docx)
  if (/^(?:\.\/)?data\//i.test(explicit)) {
    return explicit.replace(/^\.\//, "");
  }

  const base = String(baseAssetUrl || "").trim().replace(/\/+$/, "");
  const relative = String(assetRelativePath || "").trim().replace(/\\/g, "/").replace(/^\/+/, "");
  if (base && relative) return `${base}/${relative}`;
  if (relative) return `data/${relative}`;
  return "";
}

function pickInventoryUrl(item) {
  const localOrExplicit = String(item.assetUrl || "").trim();
  if (/^(?:\.\/)?data\//i.test(localOrExplicit) || /^https?:\/\//i.test(localOrExplicit)) {
    return localOrExplicit;
  }
  return (
    localOrExplicit ||
    String(item.driveDownloadUrl || "").trim() ||
    String(item.sourceUrl || "").trim()
  );
}

function buildInventoryMap(payload) {
  const map = new Map();
  for (const item of payload.items || []) {
    const key = `${item.app}::${item.exerciseId}::${item.slot}::${Number(item.itemIndex || 0)}`;
    const assetUrl = normalizeAssetUrl(
      payload.baseAssetUrl,
      pickInventoryUrl(item),
      item.assetRelativePath,
    );
    if (!assetUrl) continue;
    map.set(key, {
      assetUrl,
      label: item.label || "",
      fileRole: item.fileRole || "",
    });
  }
  return map;
}

function updateAppData(appConfig, inventoryMap) {
  const data = readJson(appConfig.sourcePath);
  let changed = 0;

  for (const exercise of data.exercises || []) {
    const docxKey = `${appConfig.app}::${exercise.id}::docxUrl::0`;
    const docxEntry = inventoryMap.get(docxKey);
    if (docxEntry && exercise.docxUrl !== docxEntry.assetUrl) {
      exercise.docxUrl = docxEntry.assetUrl;
      changed += 1;
    }

    const downloadKey = `${appConfig.app}::${exercise.id}::downloadUrl::1`;
    const downloadEntry = inventoryMap.get(downloadKey);
    if (downloadEntry && exercise.downloadUrl !== downloadEntry.assetUrl) {
      exercise.downloadUrl = downloadEntry.assetUrl;
      changed += 1;
    }

    if (Array.isArray(exercise.extraDownloadUrls)) {
      exercise.extraDownloadUrls = exercise.extraDownloadUrls.map((item, index) => {
        const inventoryKey = `${appConfig.app}::${exercise.id}::extraDownloadUrls::${index + 2}`;
        const inventoryEntry = inventoryMap.get(inventoryKey);
        if (!inventoryEntry) return item;
        changed += 1;
        if (typeof item === "string") return inventoryEntry.assetUrl;
        return {
          ...item,
          url: inventoryEntry.assetUrl,
        };
      });
    }
  }

  writeJson(appConfig.sourcePath, data);
  return changed;
}

if (!fs.existsSync(INVENTORY_PATH)) {
  throw new Error(`Inventaire introuvable : ${INVENTORY_PATH}`);
}

const payload = readJson(INVENTORY_PATH);
const inventoryMap = buildInventoryMap(payload);

if (!inventoryMap.size) {
  console.log("Aucune URL d'asset renseignee dans l'inventaire. Rien a appliquer.");
  process.exit(0);
}

for (const appConfig of APPS) {
  const count = updateAppData(appConfig, inventoryMap);
  console.log(`${appConfig.app}: ${count} lien(s) mis a jour.`);
}

console.log("Mise a jour terminee. Pensez a regenerer exercises.js et app/.");
