import { cleanupExpiredPastes } from "../jobs/cleanup.js";
import { benchmarkBatchDelete } from "../jobs/cleanup.js";
import { countExpiredPastes } from "../storage/meta-db.js";
import { closeDb } from "../storage/meta-db.js";
import { v4 as uuidv4 } from "uuid";
import { createPaste } from "../paste-service.js";

async function main(): Promise<void> {
  console.log("=== Demo: Expiration Cleanup (Batch Delete) ===\n");

  const ownerId = uuidv4();
  for (let i = 0; i < 5; i++) {
    await createPaste({
      content: `expired ${i}`,
      name: `e${i}.txt`,
      ownerId,
      visibility: "SECRET",
      expiresAt: Date.now() - 1000,
    });
  }

  console.log(`Expired pastes before cleanup: ${countExpiredPastes()}`);
  const result = await cleanupExpiredPastes(100);
  console.log(`Cleanup: deleted ${result.deleted} in ${result.batches} batch(es), ${result.elapsedMs}ms`);
  console.log(`Expired pastes after cleanup:  ${countExpiredPastes()}\n`);

  console.log("--- Batch size benchmark (500 rows, simulated) ---");
  const bench = await benchmarkBatchDelete(500, [1, 100, 1000]);
  for (const b of bench) {
    console.log(`  batch=${b.batchSize.toString().padStart(5)} → ${b.elapsedMs}ms (${b.batches} batches)`);
  }
  console.log("\nLarger batches = fewer round-trips = faster cleanup at scale.");

  closeDb();
}

main().catch(console.error);
