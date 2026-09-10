import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const INVENTORY_PATH = path.join(ROOT, "reports", "download-assets-inventory.json");
const DOWNLOAD_ROOT = path.join(ROOT, "downloads-assets-source");
const REPORT_PATH = path.join(ROOT, "reports", "download-assets-github-primary-report.json");

const APPS = ["word", "excel", "powerpoint"];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full, acc);
    else acc.push(full.replace(/\\/g, "/"));
  }
  return acc;
}

function moduleToken(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\\/g, "/")
    .split("/")
    .filter(Boolean)
    .pop()
    .replace(/^(bases|avance|complets)-\d+-/, "")
    .replace(/^m\d+-/, "");
}

function scoreMatch(item, file) {
  const base = path.basename(file).toLowerCase();
  const suggested = String(item.suggestedFileName || "").toLowerCase();
  if (!suggested || base !== suggested) return -1;

  const folder = moduleToken(item.moduleFolder || path.posix.dirname(String(item.assetRelativePath || "")));
  const fileFolder = moduleToken(path.dirname(file));
  let score = 10;

  if (fileFolder === folder) score += 50;
  else if (fileFolder.includes(folder) || folder.includes(fileFolder)) score += 30;
  else {
    const a = new Set(folder.split("-").filter((t) => t.length > 2));
    const b = new Set(fileFolder.split("-").filter((t) => t.length > 2));
    let common = 0;
    for (const token of a) if (b.has(token)) common += 1;
    score += common * 5;
  }

  if (file.includes(`downloads-assets-source/${item.app}/`)) score += 8;
  if (file.includes(`/apps/${item.app}/data/assets/`)) score += 6;
  if (file.includes(`/apps/${item.app}/app/data/assets/`)) score += 4;
  return score;
}

function localUrlFromRelative(assetRelativePath) {
  const relative = String(assetRelativePath || "")
    .replace(/\\/g, "/")
    .replace(/^\/+/, "");
  return relative ? `data/${relative}` : "";
}

function targetPaths(app, assetRelativePath) {
  const relative = String(assetRelativePath || "")
    .replace(/\\/g, "/")
    .replace(/^\/+/, "");
  return {
    dataPath: path.join(ROOT, "apps", app, "data", relative),
    appPath: path.join(ROOT, "apps", app, "app", "data", relative),
  };
}

async function downloadBinary(url, outputPath) {
  const response = await fetch(url, {
    redirect: "follow",
    headers: {
      "User-Agent": "Mozilla/5.0 ateliers-bureautique-assets",
    },
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const contentType = String(response.headers.get("content-type") || "").toLowerCase();
  if (contentType.includes("text/html")) {
    throw new Error(`HTML au lieu d'un fichier (${contentType})`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length < 64) {
    throw new Error(`Fichier trop petit (${buffer.length} o)`);
  }
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, buffer);
}

if (!fs.existsSync(INVENTORY_PATH)) {
  throw new Error(`Inventaire introuvable : ${INVENTORY_PATH}`);
}

const inventory = readJson(INVENTORY_PATH);
const items = Array.isArray(inventory.items) ? inventory.items : [];

const candidateFiles = [
  ...walk(DOWNLOAD_ROOT),
  ...APPS.flatMap((app) => walk(path.join(ROOT, "apps", app, "data", "assets"))),
  ...APPS.flatMap((app) => walk(path.join(ROOT, "apps", app, "app", "data", "assets"))),
];

const report = {
  generatedAt: new Date().toISOString(),
  total: items.length,
  copiedFromLocal: 0,
  alreadyPresent: 0,
  downloaded: 0,
  failed: [],
  items: [],
};

for (const item of items) {
  const app = item.app;
  const relative = String(item.assetRelativePath || "").replace(/\\/g, "/").replace(/^\/+/, "");
  if (!app || !relative) {
    report.failed.push({
      app,
      exerciseId: item.exerciseId,
      slot: item.slot,
      reason: "assetRelativePath manquant",
    });
    continue;
  }

  const { dataPath, appPath } = targetPaths(app, relative);
  const entry = {
    app,
    exerciseId: item.exerciseId,
    slot: item.slot,
    relative,
    source: null,
    status: null,
  };

  try {
    if (!fs.existsSync(dataPath)) {
      const downloadCandidate = path.join(DOWNLOAD_ROOT, relative.replace(/^assets\//, ""));
      let sourcePath = null;

      if (fs.existsSync(downloadCandidate)) {
        sourcePath = downloadCandidate;
      } else {
        let best = null;
        let bestScore = -1;
        for (const file of candidateFiles) {
          const score = scoreMatch(item, file);
          if (score > bestScore) {
            bestScore = score;
            best = file;
          }
        }
        // Exige une correspondance de module solide pour eviter les homonymes (annexe-1, etc.).
        if (best && bestScore >= 40) sourcePath = best;
      }

      if (sourcePath) {
        fs.mkdirSync(path.dirname(dataPath), { recursive: true });
        fs.copyFileSync(sourcePath, dataPath);
        entry.source = sourcePath;
        entry.status = "copied";
        report.copiedFromLocal += 1;
      } else {
        const remote =
          String(item.driveDownloadUrl || "").trim() ||
          (/^https?:\/\//i.test(String(item.assetUrl || "")) ? String(item.assetUrl).trim() : "") ||
          String(item.sourceUrl || "").trim();
        if (!remote) {
          throw new Error("Aucune source locale ni URL distante");
        }
        await downloadBinary(remote, dataPath);
        entry.source = remote;
        entry.status = "downloaded";
        report.downloaded += 1;
      }
    } else {
      entry.status = "present";
      report.alreadyPresent += 1;
    }

    fs.mkdirSync(path.dirname(appPath), { recursive: true });
    fs.copyFileSync(dataPath, appPath);

    item.assetUrl = localUrlFromRelative(relative);
    entry.assetUrl = item.assetUrl;
    report.items.push(entry);
  } catch (error) {
    entry.status = "failed";
    entry.error = error.message;
    report.failed.push({
      app,
      exerciseId: item.exerciseId,
      slot: item.slot,
      relative,
      reason: error.message,
    });
    report.items.push(entry);
  }
}

inventory.generatedAt = new Date().toISOString();
inventory.baseAssetUrl = "";
inventory.servingMode = "github-pages";
inventory.lastGithubPrimaryAt = inventory.generatedAt;

writeJson(INVENTORY_PATH, inventory);
writeJson(REPORT_PATH, report);

console.log(`Inventaire mis a jour : ${path.relative(ROOT, INVENTORY_PATH)}`);
console.log(`Deja presents : ${report.alreadyPresent}`);
console.log(`Copies locales : ${report.copiedFromLocal}`);
console.log(`Telecharges : ${report.downloaded}`);
console.log(`Echecs : ${report.failed.length}`);
console.log(`Rapport : ${path.relative(ROOT, REPORT_PATH)}`);

if (report.failed.length) {
  process.exitCode = 1;
}
