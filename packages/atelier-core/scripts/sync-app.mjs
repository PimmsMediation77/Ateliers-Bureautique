import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import path from "node:path";

export const DEFAULT_SYNC_ITEMS = [
  { src: "js", dst: "app/js" },
  { src: "data", dst: "app/data" },
  { src: "deployment-config.json", dst: "app/deployment-config.json" },
  { src: "styles.css", dst: "app/styles.css" },
  { src: "styles-redesign-v2.css", dst: "app/styles-redesign-v2.css" },
  { src: "index.html", dst: "app/index.html" },
  { src: "releases", dst: "app/releases" },
  { src: "README-app.txt", dst: "app/README.txt" },
];

function copyRecursive(src, dst) {
  const stat = statSync(src);

  if (stat.isDirectory()) {
    if (existsSync(dst) && !statSync(dst).isDirectory()) {
      rmSync(dst, { force: true, recursive: true });
    }
    mkdirSync(dst, { recursive: true });
    const srcEntries = readdirSync(src);
    const srcEntryNames = new Set(srcEntries);

    for (const entry of srcEntries) {
      copyRecursive(path.join(src, entry), path.join(dst, entry));
    }

    for (const entry of readdirSync(dst)) {
      if (!srcEntryNames.has(entry)) {
        rmSync(path.join(dst, entry), { force: true, recursive: true });
      }
    }
    return;
  }

  mkdirSync(path.dirname(dst), { recursive: true });
  if (existsSync(dst) && statSync(dst).isDirectory()) {
    rmSync(dst, { force: true, recursive: true });
  }
  copyFileSync(src, dst);
}

export function syncApp({ root, items = DEFAULT_SYNC_ITEMS, logger = console }) {
  if (!root) throw new Error("root est requis");

  let changed = 0;

  for (const { src, dst } of items) {
    const srcPath = path.join(root, src);
    const dstPath = path.join(root, dst);

    if (!existsSync(srcPath)) {
      logger.warn(`[sync-app] Source introuvable, ignorée : ${src}`);
      continue;
    }

    copyRecursive(srcPath, dstPath);
    logger.log(`[sync-app] Synchronisé : ${src} → ${dst}`);
    changed += 1;
  }

  logger.log(`[sync-app] Terminé. ${changed} élément(s) synchronisé(s).`);
  return changed;
}
