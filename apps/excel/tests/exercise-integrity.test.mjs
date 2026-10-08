import path from "node:path";
import { fileURLToPath } from "node:url";
import { registerExerciseIntegrityContractTests } from "../../../packages/atelier-core/tests/shared/exercise-integrity.contract.mjs";

const APP_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

await registerExerciseIntegrityContractTests({
  appRoot: APP_ROOT,
  appKey: "excel",
  appLabel: "excel",
  modelGlobalName: "ExcelAtelierModel",
});
