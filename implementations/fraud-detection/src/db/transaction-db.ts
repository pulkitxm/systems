import Database from "better-sqlite3";
import { PATHS } from "../config.js";
import type { Transaction, TransactionRequest, TxnStatus } from "../types.js";
import { v4 as uuidv4 } from "uuid";

let db: Database.Database | null = null;

export function getTransactionDb(): Database.Database {
  if (!db) {
    db = new Database(PATHS.txnDb);
    db.pragma("journal_mode = WAL");
    db.exec(`
      CREATE TABLE IF NOT EXISTS transactions (
        txn_id TEXT PRIMARY KEY,
        source_acc TEXT NOT NULL,
        target_acc TEXT NOT NULL,
        amount REAL NOT NULL,
        status TEXT NOT NULL,
        ip TEXT NOT NULL,
        region TEXT NOT NULL,
        location TEXT NOT NULL,
        target_bank TEXT NOT NULL,
        is_international INTEGER NOT NULL,
        hour_of_day INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_txn_source ON transactions(source_acc);
      CREATE INDEX IF NOT EXISTS idx_txn_status ON transactions(status);
    `);
  }
  return db;
}

export function closeTransactionDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}

function rowToTxn(row: Record<string, unknown>): Transaction {
  return {
    txnId: row.txn_id as string,
    sourceAcc: row.source_acc as string,
    targetAcc: row.target_acc as string,
    amount: row.amount as number,
    status: row.status as TxnStatus,
    ip: row.ip as string,
    region: row.region as string,
    location: row.location as string,
    targetBank: row.target_bank as string,
    isInternational: Boolean(row.is_international),
    hourOfDay: row.hour_of_day as number,
    createdAt: row.created_at as number,
  };
}

export function insertTransaction(
  req: TransactionRequest,
  status: TxnStatus = "INITIATED"
): Transaction {
  const txnId = uuidv4();
  const now = Date.now();
  const hourOfDay = req.hourOfDay ?? new Date(now).getHours();

  getTransactionDb()
    .prepare(
      `INSERT INTO transactions (
        txn_id, source_acc, target_acc, amount, status,
        ip, region, location, target_bank, is_international, hour_of_day, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      txnId,
      req.sourceAcc,
      req.targetAcc,
      req.amount,
      status,
      req.ip,
      req.region,
      req.location,
      req.targetBank,
      req.isInternational ? 1 : 0,
      hourOfDay,
      now
    );

  return getTransaction(txnId)!;
}

export function getTransaction(txnId: string): Transaction | null {
  const row = getTransactionDb()
    .prepare(`SELECT * FROM transactions WHERE txn_id = ?`)
    .get(txnId) as Record<string, unknown> | undefined;
  return row ? rowToTxn(row) : null;
}

export function updateTransactionStatus(
  txnId: string,
  status: TxnStatus
): Transaction | null {
  getTransactionDb()
    .prepare(`UPDATE transactions SET status = ? WHERE txn_id = ?`)
    .run(status, txnId);
  return getTransaction(txnId);
}

export function listTransactions(limit = 1000): Transaction[] {
  const rows = getTransactionDb()
    .prepare(`SELECT * FROM transactions ORDER BY created_at DESC LIMIT ?`)
    .all(limit) as Record<string, unknown>[];
  return rows.map(rowToTxn);
}

export function listTransactionsForTraining(): Transaction[] {
  const rows = getTransactionDb()
    .prepare(
      `SELECT * FROM transactions
       WHERE status IN ('DONE', 'FRAUD', 'FAILED', 'ALLOWED')`
    )
    .all() as Record<string, unknown>[];
  return rows.map(rowToTxn);
}
