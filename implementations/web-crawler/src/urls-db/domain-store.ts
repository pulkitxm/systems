import { getUrlsDb } from "./db.js";
import { DEFAULT_CRAWL_COOLDOWN_MS } from "../config.js";
import type { DomainConfig, DomainStatus } from "../types.js";

export function upsertDomain(config: DomainConfig): void {
  getUrlsDb()
    .prepare(
      `INSERT INTO domains (domain, cooldown_ms, status, rank, display_name)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(domain) DO UPDATE SET
         cooldown_ms = excluded.cooldown_ms,
         status = excluded.status,
         rank = excluded.rank,
         display_name = excluded.display_name`
    )
    .run(
      config.domain,
      config.cooldownMs,
      config.status,
      config.rank,
      config.displayName ?? null
    );
}

export function getDomainConfig(domain: string): DomainConfig {
  const row = getUrlsDb()
    .prepare(
      `SELECT domain, cooldown_ms, status, rank, display_name FROM domains WHERE domain = ?`
    )
    .get(domain) as
    | {
        domain: string;
        cooldown_ms: number;
        status: string;
        rank: number;
        display_name: string | null;
      }
    | undefined;

  if (!row) {
    return {
      domain,
      cooldownMs: DEFAULT_CRAWL_COOLDOWN_MS,
      status: "NORMAL",
      rank: 0,
    };
  }

  return {
    domain: row.domain,
    cooldownMs: row.cooldown_ms,
    status: row.status as DomainStatus,
    rank: row.rank,
    displayName: row.display_name ?? undefined,
  };
}

export function listDomains(): DomainConfig[] {
  const rows = getUrlsDb()
    .prepare(
      `SELECT domain, cooldown_ms, status, rank, display_name FROM domains ORDER BY rank DESC`
    )
    .all() as Array<{
    domain: string;
    cooldown_ms: number;
    status: string;
    rank: number;
    display_name: string | null;
  }>;

  return rows.map((row) => ({
    domain: row.domain,
    cooldownMs: row.cooldown_ms,
    status: row.status as DomainStatus,
    rank: row.rank,
    displayName: row.display_name ?? undefined,
  }));
}
