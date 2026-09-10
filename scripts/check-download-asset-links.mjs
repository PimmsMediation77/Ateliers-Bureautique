import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const REPORT_JSON = path.join(ROOT, "reports", "download-asset-links-check.json");
const REPORT_MD = path.join(ROOT, "reports", "download-asset-links-check.md");

const APPS = [
  {
    app: "word",
    dataPath: path.join(ROOT, "apps", "word", "data", "exercises.structured.json"),
    packagedPath: path.join(ROOT, "apps", "word", "app", "data", "exercises.structured.json"),
  },
  {
    app: "excel",
    dataPath: path.join(ROOT, "apps", "excel", "data", "exercises.structured.json"),
    packagedPath: path.join(ROOT, "apps", "excel", "app", "data", "exercises.structured.json"),
  },
  {
    app: "powerpoint",
    dataPath: path.join(ROOT, "apps", "powerpoint", "data", "exercises.structured.json"),
    packagedPath: path.join(ROOT, "apps", "powerpoint", "app", "data", "exercises.structured.json"),
  },
];

const args = new Set(process.argv.slice(2));
const allowRemote = args.has("--allow-remote");
const checkRemote = args.has("--check-remote");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function readUrlLikeEntry(entry) {
  if (typeof entry === "string") return entry;
  if (!entry || typeof entry !== "object") return "";
  if ("url" in entry) return entry.url || "";
  if ("src" in entry) return entry.src || "";
  return "";
}

function collectDownloadLinks(exercise) {
  const items = [];
  const push = (slot, source, index = 0) => {
    const value = String(readUrlLikeEntry(source) || "").trim();
    if (!value) return;
    items.push({ slot, itemIndex: index, url: value });
  };

  push("docxUrl", exercise.docxUrl, 0);
  push("downloadUrl", exercise.downloadUrl, 0);
  if (Array.isArray(exercise.extraDownloadUrls)) {
    exercise.extraDownloadUrls.forEach((entry, index) => push("extraDownloadUrls", entry, index));
  }
  return items;
}

function isRemoteUrl(value) {
  return /^https?:\/\//i.test(String(value || "").trim());
}

function isLocalDataUrl(value) {
  return /^(?:\.\/)?data\//i.test(String(value || "").trim());
}

function checkLocal(app, url) {
  const normalized = String(url || "").trim().replace(/^\.\//, "");
  const dataPath = path.join(ROOT, "apps", app, normalized);
  const packagedPath = path.join(ROOT, "apps", app, "app", normalized);
  return {
    ok: fs.existsSync(dataPath) && fs.existsSync(packagedPath),
    dataExists: fs.existsSync(dataPath),
    packagedExists: fs.existsSync(packagedPath),
    dataPath: path.relative(ROOT, dataPath).replace(/\\/g, "/"),
    packagedPath: path.relative(ROOT, packagedPath).replace(/\\/g, "/"),
  };
}

async function checkRemoteUrl(url) {
  const response = await fetch(url, {
    redirect: "follow",
    headers: { "User-Agent": "Mozilla/5.0 ateliers-bureautique-link-check" },
  });
  const contentType = String(response.headers.get("content-type") || "").toLowerCase();
  const html = contentType.includes("text/html");
  return {
    ok: response.ok && !html,
    status: response.status,
    contentType,
    html,
  };
}

const failures = [];
const warnings = [];
const results = [];
let checked = 0;

for (const appConfig of APPS) {
  const data = readJson(appConfig.dataPath);
  const packaged = readJson(appConfig.packagedPath);
  if (JSON.stringify(data) !== JSON.stringify(packaged)) {
    failures.push({
      app: appConfig.app,
      exerciseId: null,
      slot: "dataset-sync",
      url: "",
      reason: "data/ et app/data/ desynchronises",
    });
  }

  for (const exercise of data.exercises || []) {
    for (const link of collectDownloadLinks(exercise)) {
      checked += 1;
      const row = {
        app: appConfig.app,
        exerciseId: exercise.id,
        slot: link.slot,
        url: link.url,
      };

      if (isLocalDataUrl(link.url)) {
        const local = checkLocal(appConfig.app, link.url);
        row.kind = "local";
        row.ok = local.ok;
        row.details = local;
        if (!local.ok) {
          failures.push({
            ...row,
            reason: `fichier local manquant (data=${local.dataExists}, app=${local.packagedExists})`,
          });
        }
      } else if (isRemoteUrl(link.url)) {
        row.kind = "remote";
        if (!allowRemote) {
          row.ok = false;
          failures.push({
            ...row,
            reason: "URL distante interdite (primary = GitHub Pages). Utiliser data/assets/...",
          });
        } else if (checkRemote) {
          try {
            const remote = await checkRemoteUrl(link.url);
            row.ok = remote.ok;
            row.details = remote;
            if (!remote.ok) {
              failures.push({
                ...row,
                reason: `distant KO status=${remote.status} html=${remote.html}`,
              });
            }
          } catch (error) {
            row.ok = false;
            failures.push({ ...row, reason: error.message });
          }
        } else {
          row.ok = true;
          warnings.push({
            ...row,
            reason: "URL distante tolerée (--allow-remote sans --check-remote)",
          });
        }
      } else {
        row.kind = "unknown";
        row.ok = false;
        failures.push({
          ...row,
          reason: "URL non reconnue (attendu data/... ou https://...)",
        });
      }

      results.push(row);
    }
  }
}

const summary = {
  generatedAt: new Date().toISOString(),
  checked,
  failures: failures.length,
  warnings: warnings.length,
  allowRemote,
  checkRemote,
};

writeJson(REPORT_JSON, { summary, failures, warnings, results });

const lines = [
  "# Verification des liens de telechargement",
  "",
  `- Date : ${summary.generatedAt}`,
  `- Controles : ${checked}`,
  `- Echecs : ${failures.length}`,
  `- Avertissements : ${warnings.length}`,
  "",
];

if (failures.length) {
  lines.push("## Echecs", "");
  for (const failure of failures.slice(0, 100)) {
    lines.push(
      `- ${failure.app}/${failure.exerciseId || "-"} [${failure.slot}] ${failure.url || "(sans url)"} — ${failure.reason}`,
    );
  }
  if (failures.length > 100) lines.push(`- ... ${failures.length - 100} de plus`);
  lines.push("");
}

fs.mkdirSync(path.dirname(REPORT_MD), { recursive: true });
fs.writeFileSync(REPORT_MD, `${lines.join("\n")}\n`, "utf8");

console.log(`Controles : ${checked}`);
console.log(`Echecs : ${failures.length}`);
console.log(`Avertissements : ${warnings.length}`);
console.log(`Rapport JSON : ${path.relative(ROOT, REPORT_JSON)}`);
console.log(`Rapport MD : ${path.relative(ROOT, REPORT_MD)}`);

if (failures.length) {
  process.exitCode = 1;
}
