import fs from "node:fs/promises";
import path from "node:path";
import { DEFAULT_SYNC_ITEMS } from "./sync-app.mjs";

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (current === "--root") {
      result.root = argv[index + 1];
      index += 1;
    }
  }
  return result;
}

function normalizeContent(value) {
  return String(value || "").replace(/\r\n/g, "\n");
}

async function exists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function compareRecursive(srcPath, dstPath, relativePath = "") {
  const [srcStat, dstExists] = await Promise.all([
    fs.stat(srcPath),
    exists(dstPath),
  ]);

  if (!dstExists) {
    return [`${relativePath || path.basename(srcPath)} (destination manquante)`];
  }

  const dstStat = await fs.stat(dstPath);

  if (srcStat.isDirectory()) {
    if (!dstStat.isDirectory()) {
      return [`${relativePath || path.basename(srcPath)} (type different)`];
    }

    const [srcEntries, dstEntries] = await Promise.all([
      fs.readdir(srcPath),
      fs.readdir(dstPath),
    ]);
    const mismatches = [];
    const srcSet = new Set(srcEntries);
    const dstSet = new Set(dstEntries);

    for (const entry of srcEntries) {
      mismatches.push(
        ...(await compareRecursive(
          path.join(srcPath, entry),
          path.join(dstPath, entry),
          path.join(relativePath, entry),
        )),
      );
    }

    for (const entry of dstEntries) {
      if (!srcSet.has(entry)) {
        mismatches.push(`${path.join(relativePath, entry)} (present seulement dans app/)`);
      }
    }

    for (const entry of srcEntries) {
      if (!dstSet.has(entry)) {
        mismatches.push(`${path.join(relativePath, entry)} (absent de app/)`);
      }
    }

    return mismatches;
  }

  if (dstStat.isDirectory()) {
    return [`${relativePath || path.basename(srcPath)} (type different)`];
  }

  const [srcContent, dstContent] = await Promise.all([
    fs.readFile(srcPath, "utf8"),
    fs.readFile(dstPath, "utf8"),
  ]);

  return normalizeContent(srcContent) === normalizeContent(dstContent)
    ? []
    : [`${relativePath || path.basename(srcPath)} (contenu different)`];
}

async function validateAppSync(root) {
  const mismatches = [];
  const allowedAppEntries = new Set(
    DEFAULT_SYNC_ITEMS.map(({ dst }) => dst.replace(/^app\//, "").split(path.sep)[0]),
  );

  for (const { src, dst } of DEFAULT_SYNC_ITEMS) {
    mismatches.push(
      ...(await compareRecursive(
        path.join(root, src),
        path.join(root, dst),
        src,
      )).map((item) => `${src} -> ${dst}: ${item}`),
    );
  }

  const appRoot = path.join(root, "app");
  if (await exists(appRoot)) {
    const appEntries = await fs.readdir(appRoot);
    for (const entry of appEntries) {
      if (!allowedAppEntries.has(entry)) {
        mismatches.push(`app/: ${entry} (fichier ou dossier orphelin dans app/)`);
      }
    }
  }

  return mismatches;
}

const args = parseArgs(process.argv.slice(2));
const root = args.root ? path.resolve(args.root) : null;

if (!root) {
  console.error("Usage: node validate-app-sync.mjs --root <path>");
  process.exit(1);
}

const mismatches = await validateAppSync(root);

if (mismatches.length) {
  console.error("[sync-app] Derive detectee entre la source de l'application et app/ :");
  for (const mismatch of mismatches) {
    console.error(`- ${mismatch}`);
  }
  console.error("[sync-app] Relancez build:data puis sync:app avant publication.");
  process.exit(1);
}

console.log("[sync-app] Validation OK. app/ est aligne sur les sources publiees.");
