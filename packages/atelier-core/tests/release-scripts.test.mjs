import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { runUpdateReleaseArtifacts } from "../scripts/update-release-artifacts.mjs";
import { runValidateReleaseCommits } from "../scripts/validate-release-commits.mjs";

function git(cwd, args) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

async function createTempRepo() {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "atelier-core-release-"));
  git(rootDir, ["init", "--initial-branch=main"]);
  git(rootDir, ["config", "user.name", "Codex Test"]);
  git(rootDir, ["config", "user.email", "codex@example.test"]);
  return rootDir;
}

async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function writeText(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, value, "utf8");
}

function commitAll(rootDir, message) {
  git(rootDir, ["add", "."]);
  git(rootDir, ["commit", "-m", message]);
}

test("runUpdateReleaseArtifacts writes synchronized release payloads for both app targets", async () => {
  const rootDir = await createTempRepo();

  try {
    await writeJson(path.join(rootDir, "package.json"), {
      name: "excel-atelier",
      version: "1.0.0",
      private: true,
      type: "module",
    });
    await writeText(path.join(rootDir, "README.md"), "initial\n");
    commitAll(rootDir, "chore: bootstrap release fixtures");
    git(rootDir, ["tag", "excel-v1.0.0"]);

    await writeJson(path.join(rootDir, "package.json"), {
      name: "excel-atelier",
      version: "1.1.0",
      private: true,
      type: "module",
    });
    await writeText(path.join(rootDir, "README.md"), "shared runtime\n");
    commitAll(rootDir, "feat(core): add shared runtime");

    const stalePayload = {
      version: "1.1.0",
      updatedAt: "2026-01-01T00:00:00.000Z",
      releases: [
        { version: "1.1.0", summary: "stale current release" },
        { version: "1.0.0", summary: "older release" },
      ],
    };
    await writeJson(path.join(rootDir, "releases", "releases.json"), stalePayload);

    const logs = [];
    runUpdateReleaseArtifacts({
      rootDir,
      tagPrefix: "excel-v",
      logger: { log(message) { logs.push(message); } },
    });

    const releasesJson = JSON.parse(await fs.readFile(path.join(rootDir, "releases", "releases.json"), "utf8"));
    const releasesJs = await fs.readFile(path.join(rootDir, "releases", "releases.js"), "utf8");

    assert.equal(releasesJson.version, "1.1.0");
    assert.equal(releasesJson.releases[0].version, "1.1.0");
    assert.equal(releasesJson.releases[0].tag, "excel-v1.1.0");
    assert.equal(releasesJson.releases[0].releaseType, "minor");
    assert.equal(releasesJson.releases[0].impact.level, "medium");
    assert.equal(releasesJson.releases[0].elements[0].type, "feat");
    assert.equal(releasesJson.releases[0].elements[0].scope, "core");
    assert.equal(releasesJson.releases[0].counts.feat, 1);
    assert.equal(releasesJson.releases[1].version, "1.0.0");
    assert.ok(!releasesJson.releases.some((entry, index) => entry.version === "1.1.0" && index > 0));
    assert.equal(existsSync(path.join(rootDir, "app")), false, "app/ est regenere par sync:app, pas par la release");
    assert.match(releasesJs, /window\.RELEASES_DATA = /);
    assert.deepEqual(logs, ["[release-notes] Fichiers release mis a jour pour v1.1.0."]);
  } finally {
    await fs.rm(rootDir, { recursive: true, force: true });
  }
});

test("runUpdateReleaseArtifacts supports custom release targets", async () => {
  const rootDir = await createTempRepo();

  try {
    await writeJson(path.join(rootDir, "package.json"), {
      name: "ateliers-bureautique",
      version: "1.0.0",
      private: true,
      type: "module",
    });
    await writeText(path.join(rootDir, "README.md"), "initial\n");
    commitAll(rootDir, "chore: bootstrap global release fixtures");

    const logs = [];
    runUpdateReleaseArtifacts({
      rootDir,
      tagPrefix: "bureautique-v",
      releaseJsonPaths: [path.join(rootDir, "pages", "releases", "releases.json")],
      releaseJsPaths: [path.join(rootDir, "pages", "releases", "releases.js")],
      logger: { log(message) { logs.push(message); } },
    });

    const releasesJson = JSON.parse(await fs.readFile(path.join(rootDir, "pages", "releases", "releases.json"), "utf8"));
    const releasesJs = await fs.readFile(path.join(rootDir, "pages", "releases", "releases.js"), "utf8");

    assert.equal(releasesJson.version, "1.0.0");
    assert.equal(releasesJson.releases[0].tag, "bureautique-v1.0.0");
    assert.match(releasesJs, /window\.RELEASES_DATA = /);
    assert.deepEqual(logs, ["[release-notes] Fichiers release mis a jour pour v1.0.0."]);
  } finally {
    await fs.rm(rootDir, { recursive: true, force: true });
  }
});

test("runValidateReleaseCommits reports valid conventional commits since the last matching tag", async () => {
  const rootDir = await createTempRepo();

  try {
    await writeJson(path.join(rootDir, "package.json"), { name: "word-atelier", version: "1.0.0" });
    await writeText(path.join(rootDir, "README.md"), "initial\n");
    commitAll(rootDir, "chore: bootstrap release checks");
    git(rootDir, ["tag", "word-v1.0.0"]);

    await writeText(path.join(rootDir, "README.md"), "initial\nshared checks\n");
    commitAll(rootDir, "fix(core): tighten release validation");

    const errors = [];
    const result = runValidateReleaseCommits({
      cwd: rootDir,
      tagPrefix: "word-v",
      logger: { error(message) { errors.push(message); } },
    });

    assert.equal(result.ok, true);
    assert.equal(result.skipped, false);
    assert.equal(result.commits, 1);
    assert.deepEqual(errors, ["[release-check] 1 commit(s) valides depuis word-v1.0.0."]);
  } finally {
    await fs.rm(rootDir, { recursive: true, force: true });
  }
});

test("runValidateReleaseCommits reports invalid commits and honors allowed legacy hashes", async () => {
  const rootDir = await createTempRepo();

  try {
    await writeJson(path.join(rootDir, "package.json"), { name: "word-atelier", version: "1.0.0" });
    await writeText(path.join(rootDir, "README.md"), "initial\n");
    commitAll(rootDir, "chore: bootstrap release checks");
    git(rootDir, ["tag", "word-v1.0.0"]);

    await writeText(path.join(rootDir, "README.md"), "invalid commit message\n");
    commitAll(rootDir, "bad commit message");
    const invalidHash = git(rootDir, ["rev-parse", "--short", "HEAD"]);

    const skippedByLegacy = runValidateReleaseCommits({
      cwd: rootDir,
      tagPrefix: "word-v",
      allowedLegacyCommits: [invalidHash],
      logger: { error() {} },
    });
    assert.equal(skippedByLegacy.ok, true);

    const errors = [];
    const result = runValidateReleaseCommits({
      cwd: rootDir,
      tagPrefix: "word-v",
      logger: { error(message) { errors.push(message); } },
    });

    assert.equal(result.ok, false);
    assert.equal(result.invalid.length, 1);
    assert.equal(result.invalid[0].hash, invalidHash);
    assert.equal(result.invalid[0].reason, "format invalide");
    assert.ok(errors.some((message) => message.includes("bad commit message")));
  } finally {
    await fs.rm(rootDir, { recursive: true, force: true });
  }
});
