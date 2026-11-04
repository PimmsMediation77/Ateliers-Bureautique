import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const INVENTORY_PATH = path.join(ROOT, "reports", "source-assets-inventory.json");
const REPORT_JSON = path.join(ROOT, "reports", "exercise-asset-links-report.json");
const REPORT_MD = path.join(ROOT, "reports", "exercise-asset-links-report.md");

const APPS = [
  { app: "word", dataPath: path.join(ROOT, "apps", "word", "data", "exercises.structured.json"), packagedPath: path.join(ROOT, "apps", "word", "app", "data", "exercises.structured.json") },
  { app: "excel", dataPath: path.join(ROOT, "apps", "excel", "data", "exercises.structured.json"), packagedPath: path.join(ROOT, "apps", "excel", "app", "data", "exercises.structured.json") },
  { app: "powerpoint", dataPath: path.join(ROOT, "apps", "powerpoint", "data", "exercises.structured.json"), packagedPath: path.join(ROOT, "apps", "powerpoint", "app", "data", "exercises.structured.json") },
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function buildStableKey(app, exerciseId, slot, itemIndex) {
  return `${app}::${exerciseId}::${slot}::${Number(itemIndex || 0)}`;
}

function readUrlLikeEntry(entry) {
  if (typeof entry === "string") return entry;
  if (!entry || typeof entry !== "object") return "";
  if ("url" in entry) return entry.url || "";
  if ("src" in entry) return entry.src || "";
  return "";
}

function collectExerciseLinks(exercise) {
  const items = [];
  const push = (slot, source, index = 0) => {
    const value = readUrlLikeEntry(source);
    if (!String(value || "").trim()) return;
    items.push({
      slot,
      itemIndex: index,
      url: String(value).trim(),
    });
  };

  push("docxUrl", exercise.docxUrl, 0);
  push("downloadUrl", exercise.downloadUrl, 0);

  if (Array.isArray(exercise.extraDownloadUrls)) {
    exercise.extraDownloadUrls.forEach((entry, index) => push("extraDownloadUrls", entry, index));
  }

  if (Array.isArray(exercise.imageEnonce)) {
    exercise.imageEnonce.forEach((entry, index) => push("imageEnonce", entry, index));
  } else {
    push("imageEnonce", exercise.imageEnonce, 0);
  }

  if (Array.isArray(exercise.imageResultat)) {
    exercise.imageResultat.forEach((entry, index) => push("imageResultat", entry, index));
  } else {
    push("imageResultat", exercise.imageResultat, 0);
  }

  const scrape = exercise.scrape || {};
  for (const [slot, values] of [
    ["scrape.enonceImages", scrape.enonceImages],
    ["scrape.resultImages", scrape.resultImages],
    ["scrape.extraImages", scrape.extraImages],
  ]) {
    if (!Array.isArray(values)) continue;
    values.forEach((entry, index) => push(slot, entry, index));
  }

  if (Array.isArray(exercise.exerciseTabs)) {
    exercise.exerciseTabs.forEach((tab, tabIndex) => {
      for (const field of ["enonceImages", "resultImages"]) {
        if (!Array.isArray(tab[field])) continue;
        tab[field].forEach((entry, index) => push(`exerciseTabs[${tabIndex}].${field}`, entry, index));
      }
    });
  }

  return items;
}

function isRemoteUrl(value) {
  return /^https?:\/\//i.test(String(value || "").trim());
}

function checkLocalUrl(app, url) {
  const normalized = String(url || "").trim().replace(/^\.?\//, "");
  const dataPath = path.join(ROOT, "apps", app, normalized);
  const packagedPath = path.join(ROOT, "apps", app, "app", normalized);
  return {
    dataExists: fs.existsSync(dataPath),
    packagedExists: fs.existsSync(packagedPath),
    dataPath,
    packagedPath,
  };
}

function compareDatasets(appConfig) {
  const sourcePayload = readJson(appConfig.dataPath);
  const packagedPayload = readJson(appConfig.packagedPath);
  return JSON.stringify(sourcePayload) === JSON.stringify(packagedPayload);
}

if (!fs.existsSync(INVENTORY_PATH)) {
  throw new Error(`Inventaire introuvable : ${INVENTORY_PATH}`);
}

const inventory = readJson(INVENTORY_PATH);
const inventoryMap = new Map();
for (const item of inventory.items || []) {
  inventoryMap.set(buildStableKey(item.app, item.exerciseId, item.slot, item.itemIndex), item);
}

const report = {
  generatedAt: new Date().toISOString(),
  summary: {
    totalChecks: 0,
    failedChecks: 0,
    datasetSyncFailures: 0,
    byApp: {},
  },
  datasetSync: [],
  failures: [],
};

for (const appConfig of APPS) {
  const payload = readJson(appConfig.dataPath);
  const exercises = Array.isArray(payload.exercises) ? payload.exercises : [];
  const moduleStats = new Map();
  const datasetsInSync = compareDatasets(appConfig);

  report.datasetSync.push({
    app: appConfig.app,
    ok: datasetsInSync,
    sourcePath: appConfig.dataPath,
    packagedPath: appConfig.packagedPath,
  });

  if (!datasetsInSync) {
    report.summary.datasetSyncFailures += 1;
  }

  for (const exercise of exercises) {
    const moduleKey = String(exercise.moduleId || "sans-module");
    const currentModuleStats = moduleStats.get(moduleKey) || {
      moduleId: moduleKey,
      moduleName: exercise.moduleName || "",
      checks: 0,
      failures: 0,
    };

    const links = collectExerciseLinks(exercise);
    for (const link of links) {
      report.summary.totalChecks += 1;
      currentModuleStats.checks += 1;

      const stableKey = buildStableKey(appConfig.app, exercise.id, link.slot, link.itemIndex);
      const inventoryItem = inventoryMap.get(stableKey);
      const failures = [];

      // assetUrl est un instantane de la localisation de juillet 2026 : on ne le compare plus
      // aux URL du dataset, seule l'existence des fichiers fait foi.
      if (!inventoryItem) {
        failures.push("absent de l'inventaire source");
      }

      if (isRemoteUrl(link.url)) {
        failures.push("URL distante restante");
      } else {
        const localCheck = checkLocalUrl(appConfig.app, link.url);
        if (!localCheck.dataExists) failures.push("fichier absent dans apps/<app>/data");
        if (!localCheck.packagedExists) failures.push("fichier absent dans apps/<app>/app/data");
      }

      if (failures.length) {
        report.summary.failedChecks += 1;
        currentModuleStats.failures += 1;
        report.failures.push({
          app: appConfig.app,
          moduleId: moduleKey,
          moduleName: exercise.moduleName || "",
          exerciseId: exercise.id,
          exerciseNum: exercise.num,
          exerciseTitle: exercise.title || "",
          slot: link.slot,
          itemIndex: link.itemIndex,
          url: link.url,
          failures,
        });
      }
    }

    moduleStats.set(moduleKey, currentModuleStats);
  }

  report.summary.byApp[appConfig.app] = {
    modules: Array.from(moduleStats.values()).sort((left, right) => (
      left.moduleName.localeCompare(right.moduleName, "fr")
      || left.moduleId.localeCompare(right.moduleId, "fr")
    )),
  };
}

writeJson(REPORT_JSON, report);

const lines = [];
lines.push("# Verification des liens d'assets par exercice");
lines.push("");
lines.push(`Genere le : ${report.generatedAt}`);
lines.push("");
lines.push("## Resume");
lines.push("");
lines.push(`- Controles de liens : ${report.summary.totalChecks}`);
lines.push(`- Echecs de liens : ${report.summary.failedChecks}`);
lines.push(`- Jeux de donnees desynchronises : ${report.summary.datasetSyncFailures}`);
lines.push("");
lines.push("## Synchronisation des datasets");
lines.push("");
lines.push("| app | statut | source | packaged |");
lines.push("| --- | --- | --- | --- |");
for (const item of report.datasetSync) {
  lines.push(`| ${item.app} | ${item.ok ? "OK" : "ECHEC"} | ${item.sourcePath} | ${item.packagedPath} |`);
}
lines.push("");
lines.push("## Modules");
lines.push("");
lines.push("| app | moduleId | moduleName | checks | failures |");
lines.push("| --- | --- | --- | ---: | ---: |");
for (const [app, stats] of Object.entries(report.summary.byApp)) {
  for (const moduleStat of stats.modules) {
    lines.push(`| ${app} | ${moduleStat.moduleId} | ${moduleStat.moduleName} | ${moduleStat.checks} | ${moduleStat.failures} |`);
  }
}
lines.push("");

if (report.failures.length) {
  lines.push("## Echecs");
  lines.push("");
  lines.push("| app | moduleId | exerciseId | slot | url | failures |");
  lines.push("| --- | --- | --- | --- | --- | --- |");
  for (const failure of report.failures) {
    lines.push(`| ${failure.app} | ${failure.moduleId} | ${failure.exerciseId} | ${failure.slot}[${failure.itemIndex}] | ${failure.url.replace(/\|/g, "\\|")} | ${failure.failures.join("<br>")} |`);
  }
} else {
  lines.push("Aucun echec detecte.");
}

fs.mkdirSync(path.dirname(REPORT_MD), { recursive: true });
fs.writeFileSync(REPORT_MD, `${lines.join("\n")}\n`, "utf8");

console.log(`Rapport JSON : ${REPORT_JSON}`);
console.log(`Rapport Markdown : ${REPORT_MD}`);
console.log(JSON.stringify({
  totalChecks: report.summary.totalChecks,
  failedChecks: report.summary.failedChecks,
  datasetSyncFailures: report.summary.datasetSyncFailures,
}, null, 2));
