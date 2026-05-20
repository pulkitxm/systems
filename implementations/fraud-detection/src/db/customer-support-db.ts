import Database from "better-sqlite3";
import { PATHS } from "../config.js";
import type { CustomerSupportTicket } from "../types.js";
import { v4 as uuidv4 } from "uuid";

let db: Database.Database | null = null;

export function getCustomerSupportDb(): Database.Database {
  if (!db) {
    db = new Database(PATHS.csDb);
    db.pragma("journal_mode = WAL");
    db.exec(`
      CREATE TABLE IF NOT EXISTS tickets (
        ticket_id TEXT PRIMARY KEY,
        txn_id TEXT NOT NULL,
        is_fraud INTEGER NOT NULL,
        summary TEXT NOT NULL,
        resolved_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_tickets_txn ON tickets(txn_id);
    `);
  }
  return db;
}

export function closeCustomerSupportDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}

function rowToTicket(row: Record<string, unknown>): CustomerSupportTicket {
  return {
    ticketId: row.ticket_id as string,
    txnId: row.txn_id as string,
    isFraud: Boolean(row.is_fraud),
    summary: row.summary as string,
    resolvedAt: row.resolved_at as number,
  };
}

export function insertTicket(
  txnId: string,
  isFraud: boolean,
  summary: string,
  resolvedAt = Date.now()
): CustomerSupportTicket {
  const ticketId = uuidv4();
  getCustomerSupportDb()
    .prepare(
      `INSERT INTO tickets (ticket_id, txn_id, is_fraud, summary, resolved_at)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(ticketId, txnId, isFraud ? 1 : 0, summary, resolvedAt);

  return getTicket(ticketId)!;
}

export function getTicket(ticketId: string): CustomerSupportTicket | null {
  const row = getCustomerSupportDb()
    .prepare(`SELECT * FROM tickets WHERE ticket_id = ?`)
    .get(ticketId) as Record<string, unknown> | undefined;
  return row ? rowToTicket(row) : null;
}

export function getTicketByTxnId(txnId: string): CustomerSupportTicket | null {
  const row = getCustomerSupportDb()
    .prepare(`SELECT * FROM tickets WHERE txn_id = ? ORDER BY resolved_at DESC LIMIT 1`)
    .get(txnId) as Record<string, unknown> | undefined;
  return row ? rowToTicket(row) : null;
}

export function listTickets(): CustomerSupportTicket[] {
  const rows = getCustomerSupportDb()
    .prepare(`SELECT * FROM tickets ORDER BY resolved_at DESC`)
    .all() as Record<string, unknown>[];
  return rows.map(rowToTicket);
}

export function listLabeledTickets(): CustomerSupportTicket[] {
  return listTickets();
}
