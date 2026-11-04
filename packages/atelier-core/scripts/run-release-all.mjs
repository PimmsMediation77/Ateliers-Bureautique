import { existsSync } from "node:fs";
import { win32 } from "node:path";
import { spawnSync } from "node:child_process";

export function runReleaseAll({
  scriptPath = "scripts/release-all.sh",
  processImpl = process,
  spawnSyncImpl = spawnSync,
  existsSyncImpl = existsSync,
  exitOnComplete = true,
} = {}) {
  // Chemin Windows quel que soit l'hote : le test simule win32 et tourne aussi en CI Linux.
  const gitBash = processImpl.env.LOCALAPPDATA
    ? win32.join(processImpl.env.LOCALAPPDATA, "Programs", "Git", "bin", "bash.exe")
    : "";
  const bashCommand = processImpl.platform === "win32" && existsSyncImpl(gitBash) ? gitBash : "bash";
  const result = spawnSyncImpl(bashCommand, [scriptPath], {
    stdio: "inherit",
  });

  const status = result.status ?? 1;
  if (exitOnComplete) {
    processImpl.exit(status);
  }
  return status;
}
