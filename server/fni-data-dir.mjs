import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function resolveApiDataDir() {
  return process.env.FNI_API_DATA_DIR
    ? path.resolve(process.env.FNI_API_DATA_DIR)
    : path.join(__dirname, ".data");
}
