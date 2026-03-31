import pg from "pg";

const master = new pg.Pool({
  host: "localhost",
  port: 5432,
  user: "postgres",
  password: "postgres",
  database: "appdb",
});

const replica = new pg.Pool({
  host: "localhost",
  port: 5433,
  user: "postgres",
  password: "postgres",
  database: "appdb",
});

/**
 * Writes always go to master.
 */
export function write(text, params) {
  console.log(`[MASTER :5432] WRITE  ${text.trim().slice(0, 80)}`);
  return master.query(text, params);
}

/**
 * Reads are randomly distributed between master and replica.
 *
 * Master can absolutely serve reads — there's no rule that master only handles
 * writes. Since writes are infrequent (only shop owner via admin), master has
 * plenty of capacity for reads too.
 */
export function read(text, params) {
  const useMaster = Math.random() < 0.5;
  const pool = useMaster ? master : replica;
  const tag = useMaster ? "MASTER :5432" : "REPLICA:5433";
  console.log(`[${tag}] READ   ${text.trim().slice(0, 80)}`);
  return pool.query(text, params);
}

export async function close() {
  await master.end();
  await replica.end();
}

export { master, replica };
