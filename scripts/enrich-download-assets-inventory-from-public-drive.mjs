import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const ROOT = process.cwd();
const INVENTORY_PATH = path.join(ROOT, "reports", "download-assets-inventory.json");
const FOLDER_MIME = "application/vnd.google-apps.folder";

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--root" && argv[index + 1]) {
      options.root = argv[index + 1];
      index += 1;
    }
  }
  return options;
}

function normalizeFolderUrl(input) {
  const raw = String(input || "").trim();
  if (!raw) return "";
  if (/^https:\/\/drive\.google\.com\/drive\/folders\//.test(raw)) return raw;
  return `https://drive.google.com/drive/folders/${raw}`;
}

function extractDriveDataExpression(html) {
  const match = html.match(/AF_initDataCallback\(\{key: 'ds:4'.*?data:(\[.*?\]), sideChannel:/s);
  return match ? match[1] : "";
}

function isDriveItem(node) {
  return Array.isArray(node)
    && Array.isArray(node[0])
    && typeof node[0][1] === "string"
    && typeof node[4] === "string";
}

function findChildrenArray(node) {
  const candidates = [];

  function walk(value) {
    if (!Array.isArray(value)) return;
    if (value.length > 0 && value.every(isDriveItem)) {
      candidates.push(value);
      return;
    }
    for (const child of value) walk(child);
  }

  walk(node);
  candidates.sort((left, right) => right.length - left.length);
  return candidates[0] || [];
}

function parseDriveItem(item) {
  const id = item?.[0]?.[1];
  const mimeType = item?.[4];
  const name = item?.[35]?.[0]?.[0]?.[0] || "";
  if (!id || !mimeType || !name) return null;

  const isFolder = mimeType === FOLDER_MIME;
  return {
    id,
    mimeType,
    name,
    isFolder,
    folderUrl: isFolder ? `https://drive.google.com/drive/folders/${id}` : "",
    viewUrl: isFolder ? `https://drive.google.com/drive/folders/${id}` : `https://drive.google.com/file/d/${id}/view`,
    downloadUrl: isFolder ? "" : `https://drive.google.com/uc?export=download&id=${id}`,
  };
}

async function fetchFolderChildren(folderUrl, cache) {
  if (cache.has(folderUrl)) return cache.get(folderUrl);

  const response = await fetch(folderUrl, {
    headers: {
      "accept-language": "fr-FR,fr;q=0.9,en;q=0.8",
    },
  });

  if (!response.ok) {
    throw new Error(`Impossible de lire le dossier Drive : ${folderUrl} (${response.status})`);
  }

  const html = await response.text();
  const expression = extractDriveDataExpression(html);
  if (!expression) {
    throw new Error(
      `Le dossier Drive n'est pas lisible publiquement ou son format a change : ${folderUrl}`,
    );
  }

  const data = vm.runInNewContext(expression);
  const items = findChildrenArray(data)
    .map(parseDriveItem)
    .filter(Boolean);

  cache.set(folderUrl, items);
  return items;
}

function buildRequiredModules(items) {
  const byApp = new Map();
  for (const item of items) {
    if (!byApp.has(item.app)) byApp.set(item.app, new Set());
    byApp.get(item.app).add(item.moduleFolder);
  }
  return byApp;
}

function shouldReplaceAssetUrl(currentValue) {
  const current = String(currentValue || "").trim();
  if (!current) return true;
  return /drive\.google\.com|drive\.usercontent\.google\.com/.test(current);
}

function clearDriveFields(item) {
  const next = {
    ...item,
    driveModuleFolderId: "",
    driveFileId: "",
    driveViewUrl: "",
    driveDownloadUrl: "",
  };
  if (shouldReplaceAssetUrl(item.assetUrl)) {
    next.assetUrl = "";
  }
  return next;
}

function normalizeModuleKey(name) {
  return String(name || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function stripModuleDecorators(name) {
  return normalizeModuleKey(name)
    .replace(/^(bases|avance|asca|complets)-\d+-/, "")
    .replace(/^(bases|avance|asca|complets)-/, "")
    .replace(/^m\d+-/, "")
    .replace(/-(?:\d{1,3})(?=-)/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function scoreModuleNames(inventoryName, driveName) {
  const left = normalizeModuleKey(inventoryName);
  const right = normalizeModuleKey(driveName);
  if (!left || !right) return 0;
  if (left === right) return 100;

  const leftCore = stripModuleDecorators(inventoryName);
  const rightCore = stripModuleDecorators(driveName);
  if (leftCore && leftCore === rightCore) return 90;
  if (leftCore && rightCore && (rightCore.includes(leftCore) || leftCore.includes(rightCore))) {
    const shorter = Math.min(leftCore.length, rightCore.length);
    const longer = Math.max(leftCore.length, rightCore.length);
    if (shorter >= 8 && shorter / longer >= 0.55) return 70;
  }
  if (right.endsWith(left) || left.endsWith(right)) return 60;
  return 0;
}

function resolveModuleFolder(moduleName, moduleFolders, usedDriveIds) {
  const exact = moduleFolders.get(moduleName);
  if (exact && !usedDriveIds.has(exact.id)) return { folder: exact, score: 100, match: "exact" };

  let best = null;
  let bestScore = 0;
  for (const candidate of moduleFolders.values()) {
    if (usedDriveIds.has(candidate.id)) continue;
    const score = scoreModuleNames(moduleName, candidate.name);
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }

  if (!best || bestScore < 60) return { folder: null, score: bestScore, match: "none" };
  return {
    folder: best,
    score: bestScore,
    match: bestScore >= 90 ? "normalized" : "fuzzy",
  };
}

async function main() {
  if (!fs.existsSync(INVENTORY_PATH)) {
    throw new Error(`Inventaire introuvable : ${INVENTORY_PATH}`);
  }

  const options = parseArgs(process.argv.slice(2));
  const payload = readJson(INVENTORY_PATH);
  const rootUrl = normalizeFolderUrl(options.root || payload.driveRootUrl);

  if (!rootUrl) {
    throw new Error("Aucun dossier Drive racine fourni. Utilisez --root <url>.");
  }

  const items = Array.isArray(payload.items) ? payload.items : [];
  const cache = new Map();
  const requiredModules = buildRequiredModules(items);
  const rootChildren = await fetchFolderChildren(rootUrl, cache);
  const appFolders = new Map(rootChildren.filter((item) => item.isFolder).map((item) => [item.name, item]));

  let updated = 0;
  let missing = 0;
  let fuzzyMatches = 0;

  for (const [app, moduleNames] of requiredModules) {
    const appFolder = appFolders.get(app);
    if (!appFolder) {
      for (let index = 0; index < items.length; index += 1) {
        if (items[index].app !== app) continue;
        items[index] = clearDriveFields(items[index]);
        missing += 1;
      }
      continue;
    }

    const moduleChildren = await fetchFolderChildren(appFolder.folderUrl, cache);
    const moduleFolders = new Map(moduleChildren.filter((item) => item.isFolder).map((item) => [item.name, item]));
    const usedDriveIds = new Set();

    for (const moduleName of moduleNames) {
      const resolved = resolveModuleFolder(moduleName, moduleFolders, usedDriveIds);
      const moduleFolder = resolved.folder;
      const moduleIndexes = [];

      for (let index = 0; index < items.length; index += 1) {
        if (items[index].app === app && items[index].moduleFolder === moduleName) {
          moduleIndexes.push(index);
        }
      }

      if (!moduleFolder) {
        for (const index of moduleIndexes) {
          items[index] = clearDriveFields(items[index]);
          missing += 1;
        }
        continue;
      }

      usedDriveIds.add(moduleFolder.id);
      if (resolved.match !== "exact") {
        fuzzyMatches += 1;
        console.log(
          `Correspondance module ${app}: "${moduleName}" -> "${moduleFolder.name}" (${resolved.match}, score ${resolved.score})`,
        );
      }

      const driveFiles = await fetchFolderChildren(moduleFolder.folderUrl, cache);
      const fileMap = new Map(driveFiles.filter((item) => !item.isFolder).map((item) => [item.name, item]));

      for (const index of moduleIndexes) {
        const inventoryItem = items[index];
        const driveItem = fileMap.get(inventoryItem.suggestedFileName);

        if (!driveItem) {
          items[index] = clearDriveFields(inventoryItem);
          missing += 1;
          continue;
        }

        const nextItem = {
          ...inventoryItem,
          driveModuleFolderId: moduleFolder.id,
          driveFileId: driveItem.id,
          driveViewUrl: driveItem.viewUrl,
          driveDownloadUrl: driveItem.downloadUrl,
          assetUrl: shouldReplaceAssetUrl(inventoryItem.assetUrl) ? driveItem.downloadUrl : inventoryItem.assetUrl,
        };

        if (JSON.stringify(nextItem) !== JSON.stringify(inventoryItem)) {
          updated += 1;
        }

        items[index] = nextItem;
      }
    }
  }

  const nextPayload = {
    ...payload,
    driveRootUrl: rootUrl,
    lastDriveSyncAt: new Date().toISOString(),
    items,
  };

  writeJson(INVENTORY_PATH, nextPayload);

  console.log(`Dossier Drive racine : ${rootUrl}`);
  console.log(`Elements inventaire : ${items.length}`);
  console.log(`Elements enrichis ou actualises : ${updated}`);
  console.log(`Modules resolus par correspondance souple : ${fuzzyMatches}`);
  console.log(`Elements sans correspondance Drive : ${missing}`);
}

await main();
