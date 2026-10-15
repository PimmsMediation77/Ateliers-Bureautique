// Reproduit localement l'artefact GitHub Pages (cf. .github/workflows/deploy.yml)
// et le sert sous /Ateliers-Bureautique/ comme en production.
import { cpSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { join } from "node:path";

const root = process.cwd();
const outDir = join(root, ".pages-preview");
const siteDir = join(outDir, "Ateliers-Bureautique");
const port = process.env.PORT || "4173";

rmSync(outDir, { recursive: true, force: true });
mkdirSync(siteDir, { recursive: true });
cpSync(join(root, "pages"), siteDir, { recursive: true });
for (const app of ["word", "excel", "powerpoint"]) {
  cpSync(join(root, "apps", app, "app"), join(siteDir, app), { recursive: true });
}
writeFileSync(join(siteDir, ".nojekyll"), "");

console.log(`\nAperçu : http://localhost:${port}/Ateliers-Bureautique/\n`);
spawn(`npx -y serve .pages-preview -l ${port}`, { stdio: "inherit", shell: true, cwd: root });
