import { join } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

export const PATHS = {
  dataDir: join(ROOT, "data"),
  dbFile: join(ROOT, "data", "recommendations.db"),
  dataLake: join(ROOT, "data", "lake"),
} as const;

export const CLUSTERING = {
  PRODUCT_K: 4,
  USER_K: 3,
  MIN_RATING: 3.0,
} as const;

export const RECOMMENDATIONS = {
  DEFAULT_LIMIT: 5,
  EXPLOITATION_RATIO: 0.6,
  EXPLORATION_RATIO: 0.4,
  SIMILAR_USERS_SAMPLE: 5,
};
