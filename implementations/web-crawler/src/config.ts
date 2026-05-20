import { join } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

export const S3_BUCKET = "the-internet";

/** 32-byte document identifier (production: UUID or hash) */
export const DOC_ID_BYTES = 32;

export const PATHS = {
  dataDir: join(ROOT, "data"),
  localStaging: join(ROOT, "data", "crawler-staging"),
  s3Root: join(ROOT, "data", "s3", S3_BUCKET),
  urlsDb: join(ROOT, "data", "urls.db"),
  invertedIndexDb: join(ROOT, "data", "inverted-index.db"),
  archiveDir: join(ROOT, "data", "crawl-archive"),
} as const;

/** Capacity assumptions from system design slides */
export const CAPACITY = {
  WEB_PAGES: 1_000_000_000,
  UNIQUE_WORDS: 1_000_000,
  AVG_WORD_BYTES: 8,
  DOC_ID_BYTES: 32,
  /** Each word appears in ~1% of pages */
  DOCS_PER_WORD_AVG: 10_000_000,
} as const;

/** Champion list: store only top-N doc IDs per word (space optimization) */
export const CHAMPION_LIST_MAX_DOCS = 1_000_000;

/** Default domain cooldown when not configured */
export const DEFAULT_CRAWL_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 1 week

/** Daemon runs this many ms behind "now" before zipping a time partition */
export const BATCH_UPLOAD_LAG_MS = 5 * 60 * 1000;

/** Time partition granularity: 5-minute windows (HHMM on disk) */
export const PARTITION_WINDOW_MS = 5 * 60 * 1000;

export const SPIDER = {
  MAX_PAGES_PER_RUN: 50,
  MAX_DEPTH: 4,
  HTTP_ONLY: true,
} as const;
