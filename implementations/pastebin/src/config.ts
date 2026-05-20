import { join } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

export const BASE_URL = process.env.BASE_URL || "https://gist.example.com";
export const S3_BUCKET = "gist-paste";
export const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

export const PATHS = {
  dataDir: join(ROOT, "data"),
  blobDir: join(ROOT, "data", "blobs"),
  dbFile: join(ROOT, "data", "pastebin.db"),
} as const;

export const CAPACITY_DEFAULTS = {
  WRITES_PER_MONTH: 10_000_000,
  MAX_FILE_MB: 10,
  READ_RATIO: 50,
  META_BYTES_PER_ROW: 168, // uid(36) + name(120) + timestamps/visibility/owner(12)
} as const;

export const CLEANUP_DEFAULT_BATCH_SIZE = 100;
