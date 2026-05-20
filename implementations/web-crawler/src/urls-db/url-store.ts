import { v4 as uuidv4 } from "uuid";
import { getUrlsDb } from "./db.js";
import type { CrawlEvent, UrlRecord } from "../types.js";

const MAX_RECENT_CRAWLS = 5;

function parseCrawls(raw: string): CrawlEvent[] {
  try {
    return JSON.parse(raw) as CrawlEvent[];
  } catch {
    return [];
  }
}

export function extractDomain(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname;
  } catch {
    return "unknown";
  }
}

export function getOrCreateDocId(url: string): string {
  const database = getUrlsDb();
  const existing = database
    .prepare(`SELECT doc_id FROM urls WHERE url = ?`)
    .get(url) as { doc_id: string } | undefined;

  if (existing) return existing.doc_id;

  const docId = uuidv4().replace(/-/g, "").slice(0, 32);
  const domain = extractDomain(url);
  database
    .prepare(
      `INSERT INTO urls (doc_id, url, domain, last_crawled_at, recent_crawls)
       VALUES (?, ?, ?, NULL, '[]')`
    )
    .run(docId, url, domain);
  return docId;
}

export function getUrlRecord(url: string): UrlRecord | null {
  const row = getUrlsDb()
    .prepare(
      `SELECT doc_id, url, domain, last_crawled_at, recent_crawls FROM urls WHERE url = ?`
    )
    .get(url) as
    | {
        doc_id: string;
        url: string;
        domain: string;
        last_crawled_at: number | null;
        recent_crawls: string;
      }
    | undefined;

  if (!row) return null;

  return {
    docId: row.doc_id,
    url: row.url,
    domain: row.domain,
    lastCrawledAt: row.last_crawled_at,
    recentCrawls: parseCrawls(row.recent_crawls),
  };
}

export function recordCrawl(
  url: string,
  event: CrawlEvent
): UrlRecord {
  const docId = getOrCreateDocId(url);
  const database = getUrlsDb();
  const row = database
    .prepare(`SELECT recent_crawls FROM urls WHERE doc_id = ?`)
    .get(docId) as { recent_crawls: string };

  const recent = [...parseCrawls(row.recent_crawls), event].slice(
    -MAX_RECENT_CRAWLS
  );

  database
    .prepare(
      `UPDATE urls SET last_crawled_at = ?, recent_crawls = ? WHERE doc_id = ?`
    )
    .run(event.crawledAt, JSON.stringify(recent), docId);

  const updated = getUrlRecord(url);
  if (!updated) throw new Error(`URL record missing after crawl: ${url}`);
  return updated;
}

export function listUrlsByDomain(domain: string): UrlRecord[] {
  const rows = getUrlsDb()
    .prepare(
      `SELECT doc_id, url, domain, last_crawled_at, recent_crawls
       FROM urls WHERE domain = ? ORDER BY last_crawled_at DESC`
    )
    .all(domain) as Array<{
    doc_id: string;
    url: string;
    domain: string;
    last_crawled_at: number | null;
    recent_crawls: string;
  }>;

  return rows.map((row) => ({
    docId: row.doc_id,
    url: row.url,
    domain: row.domain,
    lastCrawledAt: row.last_crawled_at,
    recentCrawls: parseCrawls(row.recent_crawls),
  }));
}

export function countUrls(): number {
  const row = getUrlsDb()
    .prepare(`SELECT COUNT(*) AS c FROM urls`)
    .get() as { c: number };
  return row.c;
}
