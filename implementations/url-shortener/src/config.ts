export const BASE_URL = process.env.BASE_URL || "https://url.sml";

/** Ticket server: partition ID space into ranges for pseudo-random issuance */
export const TICKET_SERVER = {
  RANGE_COUNT: 4,
  RANGE_SIZE: 250_000,
  TOTAL_IDS: 1_000_000,
} as const;

/** Storage capacity estimate from slides: 100M URLs/month */
export const CAPACITY = {
  URLS_PER_MONTH: 100_000_000,
  SHORT_CODE_BYTES: 8,
  URL_BYTES: 120,
  BYTES_PER_RECORD: 128,
  GB_PER_MONTH: 12.8,
} as const;

/** Number of logical shards (conceptual; Redis simulates KV partition by short_code) */
export const SHARD_COUNT = 4;
