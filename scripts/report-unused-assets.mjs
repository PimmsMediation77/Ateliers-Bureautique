import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = process.cwd();
const APPS = ["word", "excel", "powerpoint"];
const REPORT_JSON = path.join(ROOT, "reports", "assets-unused-report.json");
const REPORT_MD = path.join(ROOT, "reports", "assets-unused-report.md");

function listFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    return entry.isDirectory() ? listFiles(fullPath) : [fullPath];
  });
}

function hashFile(filePath) {
  return crypto.createHash("sha1").update(fs.readFileSync(filePath)).digest("hex");
}

function collectReferences(app) {
  const dataDir = path.join(ROOT, "apps", app, "data");
  const urlPattern = new RegExp(`data/assets/${app}/[^"'\\s)]+`, "g");
  const references = new Set();
  for (const name of fs.readdirSync(dataDir)) {
    if (!/\.(json|js)$/.test(name)) continue;
    const content = fs.readFileSync(path.join(dataDir, name), "utf8");
    for (const match of content.matchAll(urlPattern)) references.add(match[0]);
  }
  return references;
}

const report = { generatedAt: new Date().toISOString(), apps: {} };

for (const app of APPS) {
  const appDir = path.join(ROOT, "apps", app);
  const references = collectReferences(app);
  const files = listFiles(path.join(appDir, "data", "assets"))
    .map((filePath) => path.relative(appDir, filePath).split(path.sep).join("/"));

  const byHash = new Map();
  for (const rel of files) {
    const hash = hashFile(path.join(appDir, rel));
    if (!byHash.has(hash)) byHash.set(hash, []);
    byHash.get(hash).push(rel);
  }

  const unused = files.filter((rel) => !references.has(rel));
  const missing = [...references].filter((rel) => !fs.existsSync(path.join(appDir, rel)));
  const duplicateGroups = [...byHash.values()].filter((group) => group.length > 1);

  report.apps[app] = {
    files: files.length,
    references: references.size,
    unused,
    missing,
    duplicateGroups,
  };
}

fs.mkdirSync(path.dirname(REPORT_JSON), { recursive: true });
fs.writeFileSync(REPORT_JSON, `${JSON.stringify(report, null, 2)}\n`);

const lines = [
  "# Assets non references et doublons",
  "",
  `Genere le : ${report.generatedAt}`,
  "",
  "| app | fichiers | references | non references | references manquantes | groupes de doublons |",
  "| --- | ---: | ---: | ---: | ---: | ---: |",
  ...APPS.map((app) => {
    const r = report.apps[app];
    return `| ${app} | ${r.files} | ${r.references} | ${r.unused.length} | ${r.missing.length} | ${r.duplicateGroups.length} |`;
  }),
];
for (const app of APPS) {
  const r = report.apps[app];
  if (r.unused.length) lines.push("", `## ${app} : non references`, "", ...r.unused.map((rel) => `- \`${rel}\``));
  if (r.missing.length) lines.push("", `## ${app} : references manquantes`, "", ...r.missing.map((rel) => `- \`${rel}\``));
}
lines.push("", "Les doublons references (meme contenu, plusieurs exercices ou emplacements) sont listes dans le rapport JSON.");
fs.writeFileSync(REPORT_MD, `${lines.join("\n")}\n`);

for (const app of APPS) {
  const r = report.apps[app];
  console.log(`${app}: ${r.files} fichiers, ${r.unused.length} non references, ${r.missing.length} references manquantes, ${r.duplicateGroups.length} groupes de doublons`);
}
console.log(`Rapport : ${path.relative(ROOT, REPORT_MD)}`);
