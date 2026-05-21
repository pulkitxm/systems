import pg from "pg";
import { execSync } from "child_process";

const createPool = (port) =>
  new pg.Pool({
    host: "localhost",
    port,
    user: "postgres",
    password: "postgres",
    database: "testdb",
    connectionTimeoutMillis: 2000,
  });

async function testConnection(pool, name) {
  try {
    const result = await pool.query("SELECT 1 as connected");
    console.log(`✅ ${name}: Connected`);
    return true;
  } catch (error) {
    console.log(`❌ ${name}: ${error.message}`);
    return false;
  }
}

async function getRowCount(pool) {
  try {
    const result = await pool.query("SELECT COUNT(*) FROM users");
    return parseInt(result.rows[0].count);
  } catch {
    return -1;
  }
}

async function demo() {
  console.log("═".repeat(60));
  console.log("FAILOVER DEMONSTRATION");
  console.log("═".repeat(60));

  console.log("\n1. Initial state - both servers running\n");

  let primary = createPool(5432);
  let replica = createPool(5433);

  await testConnection(primary, "Primary (5432)");
  await testConnection(replica, "Replica (5433)");

  const primaryCount = await getRowCount(primary);
  const replicaCount = await getRowCount(replica);
  console.log(`\nData count - Primary: ${primaryCount}, Replica: ${replicaCount}`);

  console.log("\n2. Simulating primary failure...\n");
  console.log("Stopping primary container...");

  try {
    execSync("docker stop pg_primary", { stdio: "pipe" });
    console.log("Primary stopped!\n");
  } catch (error) {
    console.log("Could not stop primary. Run: docker stop pg_primary\n");
  }

  await new Promise((r) => setTimeout(r, 2000));

  console.log("3. Testing connections after primary failure...\n");

  primary = createPool(5432);
  replica = createPool(5433);

  await testConnection(primary, "Primary (5432)");
  await testConnection(replica, "Replica (5433)");

  console.log("\n4. Promoting replica to primary...\n");
  console.log("In production, you would:");
  console.log("  a) Detect primary failure (health checks)");
  console.log("  b) Promote replica: SELECT pg_promote();");
  console.log("  c) Update DNS/connection strings to point to new primary");
  console.log("  d) Set up a new replica\n");

  try {
    await replica.query("SELECT pg_promote()");
    console.log("✅ Replica promoted to primary!\n");
  } catch (error) {
    console.log(`Promotion result: ${error.message}\n`);
  }

  await new Promise((r) => setTimeout(r, 1000));

  console.log("5. Testing write on promoted replica...\n");

  try {
    await replica.query(
      "INSERT INTO users (name, email) VALUES ($1, $2)",
      ["Failover Test", "failover@example.com"]
    );
    console.log("✅ Write succeeded on promoted replica!\n");

    const newCount = await getRowCount(replica);
    console.log(`New row count: ${newCount}`);
  } catch (error) {
    console.log(`Write failed: ${error.message}`);
    console.log("(This is expected if replica is still in recovery mode)\n");
  }

  console.log("\n6. Recovery steps...\n");
  console.log("To restore the setup:");
  console.log("  docker compose down -v");
  console.log("  docker compose up -d");
  console.log("  # Wait for initialization, then run: npm run demo\n");

  console.log("═".repeat(60));
  console.log("Failover demo complete!");
  console.log("═".repeat(60));

  await primary.end();
  await replica.end();
}

demo();
