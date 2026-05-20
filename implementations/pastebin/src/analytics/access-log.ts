import { getDb } from "../storage/meta-db.js";

export interface AccessEvent {
  uid: string;
  ip?: string;
  userAgent?: string;
}

/** Demo stub — production would push to Kafka → Elasticsearch */
export function logAccess(event: AccessEvent): void {
  getDb()
    .prepare(
      `INSERT INTO access_events (uid, accessed_at, ip, user_agent) VALUES (?, ?, ?, ?)`
    )
    .run(event.uid, Date.now(), event.ip ?? null, event.userAgent ?? null);
}

export function getAccessCount(uid: string): number {
  const row = getDb()
    .prepare(`SELECT COUNT(*) as c FROM access_events WHERE uid = ?`)
    .get(uid) as { c: number };
  return row.c;
}

export function getRecentAccesses(uid: string, limit = 10): Array<{
  accessedAt: number;
  ip: string | null;
  userAgent: string | null;
}> {
  const rows = getDb()
    .prepare(
      `SELECT accessed_at, ip, user_agent FROM access_events WHERE uid = ? ORDER BY accessed_at DESC LIMIT ?`
    )
    .all(uid, limit) as Array<{
    accessed_at: number;
    ip: string | null;
    user_agent: string | null;
  }>;

  return rows.map((r) => ({
    accessedAt: r.accessed_at,
    ip: r.ip,
    userAgent: r.user_agent,
  }));
}
