import { join } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

export const PATHS = {
  dataDir: join(ROOT, "data"),
  txnDb: join(ROOT, "data", "transactions.db"),
  csDb: join(ROOT, "data", "customer-support.db"),
  s3Root: join(ROOT, "data", "s3"),
  s3Training: join(ROOT, "data", "s3", "training"),
  s3Models: join(ROOT, "data", "s3", "models"),
} as const;

/** Fraud detection service must respond within 200ms (production SLA) */
export const FRAUD_SLA_MS = 200;

/** Random forest: number of trees and feature subsets per tree */
export const FOREST = {
  TREE_COUNT: 5,
  MAX_DEPTH: 6,
  MIN_SAMPLES_SPLIT: 2,
} as const;

/** Feature names used for training and classification */
export const FEATURE_NAMES = [
  "amount",
  "is_international",
  "hour_of_day",
  "region_code",
  "location_code",
  "target_bank_code",
] as const;

export type FeatureName = (typeof FEATURE_NAMES)[number];

/** ETL writes multiple JSON shards (simulates Spark partitions) */
export const ETL_SHARD_SIZE = 50;
