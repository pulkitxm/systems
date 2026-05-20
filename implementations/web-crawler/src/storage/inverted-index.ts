import Database from "better-sqlite3";
import { PATHS, CHAMPION_LIST_MAX_DOCS } from "../config.js";
import type { InvertedIndexStats, SearchResult } from "../types.js";

let db: Database.Database | null = null;

export function getInvertedIndexDb(): Database.Database {
  if (!db) {
    db = new Database(PATHS.invertedIndexDb);
    db.pragma("journal_mode = WAL");
    db.exec(`
      CREATE TABLE IF NOT EXISTS inverted_index (
        word TEXT PRIMARY KEY,
        doc_ids TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS processed_batches (
        s3_uri TEXT PRIMARY KEY,
        processed_at INTEGER NOT NULL
      );
    `);
  }
  return db;
}

export function closeInvertedIndexDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}

function parseDocIds(raw: string): string[] {
  try {
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

/** Append doc IDs for a word; apply champion-list cap */
export function indexTokens(
  docId: string,
  tokens: string[],
  useChampionList = true
): number {
  const database = getInvertedIndexDb();
  const upsert = database.prepare(`
    INSERT INTO inverted_index (word, doc_ids, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(word) DO UPDATE SET
      doc_ids = excluded.doc_ids,
      updated_at = excluded.updated_at
  `);

  const now = Date.now();
  let updates = 0;

  const byWord = new Map<string, string[]>();
  for (const token of tokens) {
    if (token.length < 2) continue;
    const list = byWord.get(token) ?? [];
    list.push(docId);
    byWord.set(token, list);
  }

  const select = database.prepare(
    `SELECT doc_ids FROM inverted_index WHERE word = ?`
  );

  for (const [word, newIds] of byWord) {
    const row = select.get(word) as { doc_ids: string } | undefined;
    const existing = row ? parseDocIds(row.doc_ids) : [];
    const merged = [...new Set([...existing, ...newIds])];
    const capped = useChampionList
      ? merged.slice(0, CHAMPION_LIST_MAX_DOCS)
      : merged;
    upsert.run(word, JSON.stringify(capped), now);
    updates++;
  }

  return updates;
}

export function searchWords(words: string[]): SearchResult[] {
  const database = getInvertedIndexDb();
  const stmt = database.prepare(
    `SELECT word, doc_ids FROM inverted_index WHERE word = ?`
  );

  return words.map((w) => {
    const row = stmt.get(w.toLowerCase()) as
      | { word: string; doc_ids: string }
      | undefined;
    return {
      word: w.toLowerCase(),
      docIds: row ? parseDocIds(row.doc_ids) : [],
    };
  });
}

export function markBatchProcessed(s3Uri: string): void {
  getInvertedIndexDb()
    .prepare(
      `INSERT OR REPLACE INTO processed_batches (s3_uri, processed_at) VALUES (?, ?)`
    )
    .run(s3Uri, Date.now());
}

export function isBatchProcessed(s3Uri: string): boolean {
  const row = getInvertedIndexDb()
    .prepare(`SELECT 1 FROM processed_batches WHERE s3_uri = ?`)
    .get(s3Uri);
  return !!row;
}

export function getInvertedIndexStats(): InvertedIndexStats {
  const database = getInvertedIndexDb();
  const rows = database
    .prepare(`SELECT doc_ids FROM inverted_index`)
    .all() as { doc_ids: string }[];

  let totalDocReferences = 0;
  let championTrimmedWords = 0;

  for (const row of rows) {
    const ids = parseDocIds(row.doc_ids);
    totalDocReferences += ids.length;
    if (ids.length >= CHAMPION_LIST_MAX_DOCS) championTrimmedWords++;
  }

  return {
    wordCount: rows.length,
    totalDocReferences,
    championTrimmedWords,
  };
}
