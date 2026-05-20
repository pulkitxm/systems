import Database from "better-sqlite3";
import { PATHS } from "../config.js";

let db: Database.Database | null = null;

export function getUrlsDb(): Database.Database {
  if (!db) {
    db = new Database(PATHS.urlsDb);
    db.pragma("journal_mode = WAL");
    db.exec(`
      CREATE TABLE IF NOT EXISTS urls (
        doc_id TEXT PRIMARY KEY,
        url TEXT NOT NULL UNIQUE,
        domain TEXT NOT NULL,
        last_crawled_at INTEGER,
        recent_crawls TEXT NOT NULL DEFAULT '[]'
      );
      CREATE INDEX IF NOT EXISTS idx_urls_domain ON urls(domain);

      CREATE TABLE IF NOT EXISTS domains (
        domain TEXT PRIMARY KEY,
        cooldown_ms INTEGER NOT NULL,
        status TEXT NOT NULL,
        rank INTEGER NOT NULL DEFAULT 0,
        display_name TEXT
      );
    `);
  }
  return db;
}

export function closeUrlsDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
