import pg from "pg";

const primary = new pg.Pool({
  host: "localhost",
  port: 5432,
  user: "postgres",
  password: "postgres",
  database: "testdb",
});

const replica = new pg.Pool({
  host: "localhost",
  port: 5433,
  user: "postgres",
  password: "postgres",
  database: "testdb",
});

async function setup() {
  console.log("Creating table on primary...\n");
  await primary.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100),
      email VARCHAR(100),
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  console.log("Table created!\n");
}

async function insertOnPrimary(name, email) {
  const result = await primary.query(
    "INSERT INTO users (name, email) VALUES ($1, $2) RETURNING *",
    [name, email]
  );
  return result.rows[0];
}

async function readFromReplica() {
  const result = await replica.query("SELECT * FROM users ORDER BY id DESC LIMIT 5");
  return result.rows;
}

async function checkReplicationStatus() {
  const result = await primary.query(`
    SELECT 
      client_addr,
      state,
      sent_lsn,
      replay_lsn,
      replay_lag
    FROM pg_stat_replication
  `);
  return result.rows;
}

async function demo() {
  try {
    await setup();

    console.log("═".repeat(50));
    console.log("DEMO: PostgreSQL Streaming Replication");
    console.log("═".repeat(50));

    console.log("\n1. Checking replication status...\n");
    const status = await checkReplicationStatus();
    if (status.length > 0) {
      console.log("Replica connected:");
      console.table(status);
    } else {
      console.log("No replica connected yet. Wait a moment and try again.\n");
      return;
    }

    console.log("\n2. Inserting data on PRIMARY (port 5432)...\n");
    const user1 = await insertOnPrimary("Alice", "alice@example.com");
    console.log("Inserted:", user1);

    const user2 = await insertOnPrimary("Bob", "bob@example.com");
    console.log("Inserted:", user2);

    const user3 = await insertOnPrimary("Charlie", "charlie@example.com");
    console.log("Inserted:", user3);

    await new Promise((r) => setTimeout(r, 100));

    console.log("\n3. Reading data from REPLICA (port 5433)...\n");
    const users = await readFromReplica();
    console.log("Users on replica:");
    console.table(users);

    console.log("\n4. Demonstrating replication lag...\n");
    console.log("Inserting 100 records rapidly on primary...");
    const start = Date.now();
    for (let i = 0; i < 100; i++) {
      await insertOnPrimary(`User${i}`, `user${i}@example.com`);
    }
    console.log(`Inserted 100 records in ${Date.now() - start}ms`);

    await new Promise((r) => setTimeout(r, 200));

    const countPrimary = await primary.query("SELECT COUNT(*) FROM users");
    const countReplica = await replica.query("SELECT COUNT(*) FROM users");

    console.log(`\nPrimary count: ${countPrimary.rows[0].count}`);
    console.log(`Replica count: ${countReplica.rows[0].count}`);

    if (countPrimary.rows[0].count === countReplica.rows[0].count) {
      console.log("\nReplica is fully caught up!");
    } else {
      console.log("\nReplica has slight lag (normal for async replication)");
    }

    console.log("\n5. Final replication status...\n");
    const finalStatus = await checkReplicationStatus();
    console.table(finalStatus);

    console.log("\n" + "═".repeat(50));
    console.log("Demo complete!");
    console.log("═".repeat(50));

  } catch (error) {
    console.error("Error:", error.message);
  } finally {
    await primary.end();
    await replica.end();
  }
}

demo();
