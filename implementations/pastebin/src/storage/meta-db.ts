import Database from "better-sqlite3";
import { PATHS } from "../config.js";
import type { CreatePasteInput, PasteMetadata, Visibility } from "../types.js";

let db: Database.Database | null = null;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS store (
  uid TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  visibility TEXT NOT NULL CHECK(visibility IN ('PUBLIC', 'SECRET')),
  owner_id TEXT NOT NULL,
  expires_at INTEGER,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS access_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uid TEXT NOT NULL,
  accessed_at INTEGER NOT NULL,
  ip TEXT,
  user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_store_expires ON store(expires_at);
`;

function rowToMetadata(row: Record<string, unknown>): PasteMetadata {
  return {
    uid: row.uid as string,
    name: row.name as string,
    createdAt: row.created_at as number,
    visibility: row.visibility as Visibility,
    ownerId: row.owner_id as string,
    expiresAt: (row.expires_at as number | null) ?? null,
    updatedAt: row.updated_at as number,
  };
}

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(PATHS.dbFile);
    db.exec(SCHEMA);
  }
  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}

export function insertPaste(
  uid: string,
  input: CreatePasteInput,
  now = Date.now()
): PasteMetadata {
  const database = getDb();
  database
    .prepare(
      `INSERT INTO store (uid, name, created_at, visibility, owner_id, expires_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      uid,
      input.name,
      now,
      input.visibility,
      input.ownerId,
      input.expiresAt ?? null,
      now
    );

  return {
    uid,
    name: input.name,
    createdAt: now,
    visibility: input.visibility,
    ownerId: input.ownerId,
    expiresAt: input.expiresAt ?? null,
    updatedAt: now,
  };
}

export function getPasteByUid(uid: string): PasteMetadata | null {
  const row = getDb().prepare(`SELECT * FROM store WHERE uid = ?`).get(uid) as
    | Record<string, unknown>
    | undefined;
  return row ? rowToMetadata(row) : null;
}

export function updatePasteContent(uid: string, name?: string): void {
  const now = Date.now();
  if (name) {
    getDb()
      .prepare(`UPDATE store SET updated_at = ?, name = ? WHERE uid = ?`)
      .run(now, name, uid);
  } else {
    getDb().prepare(`UPDATE store SET updated_at = ? WHERE uid = ?`).run(now, uid);
  }
}

export function deletePaste(uid: string): void {
  getDb().prepare(`DELETE FROM store WHERE uid = ?`).run(uid);
}

export function getExpiredPastes(limit: number): PasteMetadata[] {
  const now = Date.now();
  const rows = getDb()
    .prepare(
      `SELECT * FROM store WHERE expires_at IS NOT NULL AND expires_at < ? LIMIT ?`
    )
    .all(now, limit) as Record<string, unknown>[];
  return rows.map(rowToMetadata);
}

export function countExpiredPastes(): number {
  const now = Date.now();
  const row = getDb()
    .prepare(
      `SELECT COUNT(*) as c FROM store WHERE expires_at IS NOT NULL AND expires_at < ?`
    )
    .get(now) as { c: number };
  return row.c;
}

export function getSchemaColumns(): string[] {
  const rows = getDb().prepare(`PRAGMA table_info(store)`).all() as Array<{ name: string }>;
  return rows.map((r) => r.name);
}
