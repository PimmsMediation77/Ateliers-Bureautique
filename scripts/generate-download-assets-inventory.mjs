import fs from "node:fs";
import path from "node:path";
import { buildCanonicalModuleFolder, buildLegacyModuleFolder, slugify } from "./lib/module-folder.mjs";

const ROOT = process.cwd();
const JSON_OUTPUT = path.join(ROOT, "reports", "download-assets-inventory.json");
const XLSX_OUTPUT = path.join(ROOT, "reports", "download-assets-inventory.xlsx");

const APPS = [
  {
    app: "word",
    prefix: "word",
    sourcePath: path.join(ROOT, "apps", "word", "data", "exercises.structured.json"),
  },
  {
    app: "excel",
    prefix: "excel",
    sourcePath: path.join(ROOT, "apps", "excel", "data", "exercises.structured.json"),
  },
  {
    app: "powerpoint",
    prefix: "powerpoint",
    sourcePath: path.join(ROOT, "apps", "powerpoint", "data", "exercises.structured.json"),
  },
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readExistingInventory(filePath) {
  if (!fs.existsSync(filePath)) {
    return { generatedAt: "", baseAssetUrl: "", driveRootUrl: "", lastDriveSyncAt: "", items: [] };
  }
  return readJson(filePath);
}

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function getExerciseNumber(exercise) {
  const num = Number(exercise && exercise.num);
  if (Number.isFinite(num) && num > 0) return String(num).padStart(3, "0");
  const id = String(exercise && exercise.id || "");
  const match = id.match(/(\d{1,3})$/);
  return match ? String(match[1]).padStart(3, "0") : "000";
}

function buildDuplicateExerciseMap(exercises) {
  const counts = new Map();
  for (const exercise of exercises) {
    const key = `${exercise.moduleId || ""}::${getExerciseNumber(exercise)}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return counts;
}

function buildExerciseBaseName(appConfig, exercise, duplicateExerciseMap) {
  const exerciseNo = getExerciseNumber(exercise);
  const duplicateKey = `${exercise.moduleId || ""}::${exerciseNo}`;
  const duplicateCount = duplicateExerciseMap.get(duplicateKey) || 0;

  if (duplicateCount <= 1) {
    return `${appConfig.prefix}-ex-${exerciseNo}`;
  }

  const globalIndex = Number(exercise && exercise.globalIndex);
  if (Number.isFinite(globalIndex) && globalIndex > 0) {
    return `${appConfig.prefix}-ex-${exerciseNo}-g${String(globalIndex).padStart(3, "0")}`;
  }

  return `${appConfig.prefix}-ex-${exerciseNo}-${slugify(exercise.id || exercise.title, "dup")}`;
}

function defaultExtensionForApp(app) {
  if (app === "word") return ".docx";
  if (app === "powerpoint") return ".pptx";
  if (app === "excel") return ".xlsx";
  return ".bin";
}

function isDriveUrl(url) {
  try {
    const host = new URL(String(url || "")).hostname.toLowerCase();
    return host === "drive.google.com" || host.endsWith(".googleusercontent.com");
  } catch {
    return false;
  }
}

function getExtension(url, fallback = ".bin") {
  try {
    const parsed = new URL(String(url || ""));
    const lastSegment = decodeURIComponent(parsed.pathname.split("/").filter(Boolean).pop() || "");
    const match = lastSegment.match(/\.[a-z0-9]{2,8}$/i);
    if (match && match[0].toLowerCase() !== ".html") return match[0].toLowerCase();
    const downloadParam = parsed.searchParams.get("download") || "";
    const lowerDownload = downloadParam.toLowerCase();
    if (lowerDownload.endsWith(".docx")) return ".docx";
    if (lowerDownload.endsWith(".xlsx")) return ".xlsx";
    if (lowerDownload.endsWith(".pptx")) return ".pptx";
    if (parsed.pathname.toLowerCase().includes("power-point")) return ".pptx";
    if (parsed.pathname.toLowerCase().includes("word")) return ".docx";
    if (parsed.pathname.toLowerCase().includes("excel")) return ".xlsx";
    return fallback;
  } catch {
    return fallback;
  }
}

function getFileRole(slot) {
  if (slot === "docxUrl") return "principal";
  if (slot === "downloadUrl") return "annexe";
  return "annexe";
}

function pushItem(items, appConfig, exercise, slot, sourceUrl, index = 0, label = "", duplicateExerciseMap = new Map()) {
  const url = typeof sourceUrl === "string"
    ? sourceUrl.trim()
    : String(sourceUrl && sourceUrl.url || "").trim();
  if (!url) return;

  const moduleStem = buildCanonicalModuleFolder(exercise);
  const extension = getExtension(url, defaultExtensionForApp(appConfig.app));
  const isPrimary = slot === "docxUrl";
  const exerciseBaseName = buildExerciseBaseName(appConfig, exercise, duplicateExerciseMap);
  const suggestedFileName = isPrimary
    ? `${exerciseBaseName}${extension}`
    : `${exerciseBaseName}-annexe-${index}${extension}`;
  const assetRelativePath = path.posix.join("assets", appConfig.app, moduleStem, suggestedFileName);

  items.push({
    app: appConfig.app,
    exerciseId: exercise.id,
    exerciseNum: Number(exercise.num || 0),
    moduleId: exercise.moduleId || "",
    moduleFolder: moduleStem,
    moduleLegacyFolder: String(exercise.moduleLegacyFolder || "").trim(),
    title: exercise.title || "",
    slot,
    itemIndex: index,
    fileRole: getFileRole(slot),
    label,
    sourceUrl: url,
    suggestedFileName,
    assetRelativePath,
    driveModuleFolderId: "",
    driveFileId: "",
    driveViewUrl: "",
    driveDownloadUrl: "",
    assetUrl: "",
    status: "",
    notes: "",
  });
}

function buildItems() {
  const items = [];

  for (const appConfig of APPS) {
    const data = readJson(appConfig.sourcePath);
    const exercises = Array.isArray(data.exercises) ? data.exercises : [];
    const moduleMap = new Map((data.modules || []).map((module) => [module.id, module]));
    const duplicateExerciseMap = buildDuplicateExerciseMap(exercises);

    for (const exercise of exercises) {
      const moduleMeta = moduleMap.get(exercise.moduleId) || {};
      const normalizedExercise = {
        ...moduleMeta,
        ...exercise,
        section: exercise.section || moduleMeta.section,
        orderInSection: exercise.orderInSection || moduleMeta.orderInSection,
        moduleName: exercise.moduleName || moduleMeta.name,
        moduleNameClean: exercise.moduleNameClean || moduleMeta.cleanName || exercise.moduleName,
        moduleSlug: slugify(moduleMeta.cleanName || exercise.moduleNameClean || exercise.moduleName, "module"),
        moduleLegacyFolder: buildLegacyModuleFolder({
          moduleId: exercise.moduleId || moduleMeta.id,
          moduleName: exercise.moduleName || moduleMeta.name,
          moduleNameClean: exercise.moduleNameClean || moduleMeta.cleanName || exercise.moduleName,
        }),
      };

      pushItem(items, appConfig, normalizedExercise, "docxUrl", normalizedExercise.docxUrl, 0, "Fichier principal", duplicateExerciseMap);

      let annexIndex = 1;
      if (normalizedExercise.downloadUrl) {
        pushItem(items, appConfig, normalizedExercise, "downloadUrl", normalizedExercise.downloadUrl, annexIndex, normalizedExercise.downloadLabel || "Annexe 1", duplicateExerciseMap);
        annexIndex += 1;
      }
      if (Array.isArray(normalizedExercise.extraDownloadUrls)) {
        for (const extra of normalizedExercise.extraDownloadUrls) {
          pushItem(
            items,
            appConfig,
            normalizedExercise,
            "extraDownloadUrls",
            extra,
            annexIndex,
            extra && extra.label ? extra.label : `Annexe ${annexIndex}`,
            duplicateExerciseMap,
          );
          annexIndex += 1;
        }
      }
    }
  }

  return items.sort((a, b) => (
    a.app.localeCompare(b.app, "fr")
    || a.moduleFolder.localeCompare(b.moduleFolder, "fr")
    || a.exerciseNum - b.exerciseNum
    || a.slot.localeCompare(b.slot, "fr")
    || a.itemIndex - b.itemIndex
  ));
}

function buildStableKey(item) {
  return `${item.app}::${item.exerciseId}::${item.slot}::${Number(item.itemIndex || 0)}`;
}

function mergeWithExisting(items, existingInventory) {
  const existingItems = Array.isArray(existingInventory.items) ? existingInventory.items : [];
  const existingMap = new Map(existingItems.map((item) => [buildStableKey(item), item]));

  return items.map((item) => {
    const existing = existingMap.get(buildStableKey(item));
    if (!existing) return item;

    const merged = {
      ...item,
      driveModuleFolderId: typeof existing.driveModuleFolderId === "string" ? existing.driveModuleFolderId : "",
      driveFileId: typeof existing.driveFileId === "string" ? existing.driveFileId : "",
      driveViewUrl: typeof existing.driveViewUrl === "string" ? existing.driveViewUrl : "",
      driveDownloadUrl: typeof existing.driveDownloadUrl === "string" ? existing.driveDownloadUrl : "",
      assetUrl: typeof existing.assetUrl === "string" ? existing.assetUrl : "",
      status: typeof existing.status === "string" ? existing.status : "",
      notes: typeof existing.notes === "string" ? existing.notes : "",
    };

    // Garder la source clic-formation d'origine si l'exercice pointe deja vers Drive,
    // et recalculer l'extension a partir de cette source (sinon .xlsx/.docx par defaut app).
    if (
      isDriveUrl(item.sourceUrl)
      && typeof existing.sourceUrl === "string"
      && existing.sourceUrl.trim()
      && !isDriveUrl(existing.sourceUrl)
    ) {
      merged.sourceUrl = existing.sourceUrl;
      const ext = getExtension(existing.sourceUrl, defaultExtensionForApp(item.app));
      const baseName = String(item.suggestedFileName || "").replace(/\.[^.]+$/, "");
      if (baseName) {
        merged.suggestedFileName = `${baseName}${ext}`;
      }
    }

    // Stabiliser le dossier module deja utilise dans l'inventaire / Drive.
    if (
      typeof existing.moduleFolder === "string"
      && existing.moduleFolder.trim()
      && existing.moduleFolder !== item.moduleFolder
    ) {
      merged.moduleFolder = existing.moduleFolder;
    }

    merged.assetRelativePath = path.posix.join(
      "assets",
      item.app,
      merged.moduleFolder || item.moduleFolder,
      merged.suggestedFileName,
    );

    return merged;
  });
}

function xmlEscape(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function columnName(index) {
  let n = index + 1;
  let name = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    name = String.fromCharCode(65 + rem) + name;
    n = Math.floor((n - 1) / 26);
  }
  return name;
}

function makeSheetXml(rows) {
  const header = [
    [
      "app",
      "exerciseId",
      "exerciseNum",
      "moduleId",
      "moduleFolder",
      "title",
      "slot",
      "itemIndex",
      "fileRole",
      "label",
      "sourceUrl",
      "suggestedFileName",
      "assetRelativePath",
      "driveModuleFolderId",
      "driveFileId",
      "driveViewUrl",
      "driveDownloadUrl",
      "assetUrl",
      "status",
      "notes",
    ],
    ...rows,
  ];
  const rowXml = header.map((cells, rowIndex) => {
    const cellsXml = cells.map((cell, cellIndex) => {
      const ref = `${columnName(cellIndex)}${rowIndex + 1}`;
      return `<c r="${ref}" t="inlineStr"><is><t>${xmlEscape(cell)}</t></is></c>`;
    }).join("");
    return `<row r="${rowIndex + 1}">${cellsXml}</row>`;
  }).join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheetViews><sheetView workbookViewId="0"/></sheetViews>
  <sheetFormatPr defaultRowHeight="15"/>
  <cols>
    <col min="1" max="1" width="12" customWidth="1"/>
    <col min="2" max="2" width="20" customWidth="1"/>
    <col min="3" max="3" width="12" customWidth="1"/>
    <col min="4" max="4" width="20" customWidth="1"/>
    <col min="5" max="5" width="28" customWidth="1"/>
    <col min="6" max="6" width="36" customWidth="1"/>
    <col min="7" max="7" width="20" customWidth="1"/>
    <col min="8" max="8" width="10" customWidth="1"/>
    <col min="9" max="9" width="14" customWidth="1"/>
    <col min="10" max="10" width="24" customWidth="1"/>
    <col min="11" max="11" width="72" customWidth="1"/>
    <col min="12" max="12" width="34" customWidth="1"/>
    <col min="13" max="13" width="48" customWidth="1"/>
    <col min="14" max="14" width="24" customWidth="1"/>
    <col min="15" max="15" width="24" customWidth="1"/>
    <col min="16" max="16" width="44" customWidth="1"/>
    <col min="17" max="17" width="44" customWidth="1"/>
    <col min="18" max="18" width="44" customWidth="1"/>
    <col min="19" max="19" width="16" customWidth="1"/>
    <col min="20" max="20" width="40" customWidth="1"/>
  </cols>
  <sheetData>${rowXml}</sheetData>
</worksheet>`;
}

function makeWorkbookXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="Inventory" sheetId="1" r:id="rId1"/></sheets>
</workbook>`;
}

function makeWorkbookRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;
}

function makeRootRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;
}

function makeContentTypesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;
}

function makeStylesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>
  <fills count="1"><fill><patternFill patternType="none"/></fill></fills>
  <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;
}

function createZip(entries) {
  const fileParts = [];
  const centralParts = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name);
    const dataBuf = Buffer.from(entry.data, "utf8");
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0, 12);
    localHeader.writeUInt32LE(0, 14);
    localHeader.writeUInt32LE(dataBuf.length, 18);
    localHeader.writeUInt32LE(dataBuf.length, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28);
    fileParts.push(localHeader, nameBuf, dataBuf);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0, 14);
    centralHeader.writeUInt32LE(0, 16);
    centralHeader.writeUInt32LE(dataBuf.length, 20);
    centralHeader.writeUInt32LE(dataBuf.length, 24);
    centralHeader.writeUInt16LE(nameBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);
    centralParts.push(centralHeader, nameBuf);

    offset += localHeader.length + nameBuf.length + dataBuf.length;
  }

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...fileParts, ...centralParts, end]);
}

function writeXlsx(items) {
  const rows = items.map((item) => [
    item.app,
    item.exerciseId,
    item.exerciseNum,
    item.moduleId,
    item.moduleFolder,
    item.title,
    item.slot,
    item.itemIndex,
    item.fileRole,
    item.label,
    item.sourceUrl,
    item.suggestedFileName,
    item.assetRelativePath,
    item.driveModuleFolderId,
    item.driveFileId,
    item.driveViewUrl,
    item.driveDownloadUrl,
    item.assetUrl,
    item.status,
    item.notes,
  ]);

  const zip = createZip([
    { name: "[Content_Types].xml", data: makeContentTypesXml() },
    { name: "_rels/.rels", data: makeRootRelsXml() },
    { name: "xl/workbook.xml", data: makeWorkbookXml() },
    { name: "xl/_rels/workbook.xml.rels", data: makeWorkbookRelsXml() },
    { name: "xl/styles.xml", data: makeStylesXml() },
    { name: "xl/worksheets/sheet1.xml", data: makeSheetXml(rows) },
  ]);

  ensureDir(XLSX_OUTPUT);
  fs.writeFileSync(XLSX_OUTPUT, zip);
}

const existingInventory = readExistingInventory(JSON_OUTPUT);
const items = mergeWithExisting(buildItems(), existingInventory);
const payload = {
  generatedAt: new Date().toISOString(),
  baseAssetUrl: typeof existingInventory.baseAssetUrl === "string" ? existingInventory.baseAssetUrl : "",
  driveRootUrl: typeof existingInventory.driveRootUrl === "string" ? existingInventory.driveRootUrl : "",
  lastDriveSyncAt: typeof existingInventory.lastDriveSyncAt === "string" ? existingInventory.lastDriveSyncAt : "",
  items,
};

ensureDir(JSON_OUTPUT);
fs.writeFileSync(JSON_OUTPUT, `${JSON.stringify(payload, null, 2)}\n`);
writeXlsx(items);

console.log(`Inventaire JSON genere : ${JSON_OUTPUT}`);
console.log(`Inventaire XLSX genere : ${XLSX_OUTPUT}`);
console.log(`Lignes generees : ${items.length}`);
