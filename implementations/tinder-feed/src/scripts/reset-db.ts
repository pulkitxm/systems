import { redis, closeConnection } from "../connection.js";
import { header, subheader } from "../utils.js";

async function main() {
  header("Tinder Feed - Reset Database");

  subheader("Scanning for Tinder keys");

  let cursor = "0";
  const keysToDelete: string[] = [];

  do {
    const [nextCursor, keys] = await redis.scan(
      cursor,
      "MATCH",
      "tinder:*",
      "COUNT",
      100
    );
    cursor = nextCursor;
    keysToDelete.push(...keys);
  } while (cursor !== "0");

  console.log(`Found ${keysToDelete.length} keys to delete`);

  if (keysToDelete.length === 0) {
    console.log("\nNo data to delete. Database is already clean.");
    await closeConnection();
    return;
  }

  subheader("Deleting keys");

  const batchSize = 100;
  for (let i = 0; i < keysToDelete.length; i += batchSize) {
    const batch = keysToDelete.slice(i, i + batchSize);
    await redis.del(...batch);
    console.log(`Deleted ${Math.min(i + batchSize, keysToDelete.length)}/${keysToDelete.length} keys`);
  }

  console.log("\n" + "=".repeat(60));
  console.log("✅ Database reset complete!");
  console.log("\nNext: Run 'pnpm seed' to populate sample data");

  await closeConnection();
}

main().catch(console.error);
