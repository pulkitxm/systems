import type { Priority } from "./connection.js";
import { createWorker, createAllWorkers } from "./worker.js";
import { createIteratorWorker } from "./iterator.js";

const arg = process.argv[2]?.toUpperCase();

if (!arg || !["P1", "P2", "P3", "ALL"].includes(arg)) {
  console.log("Usage: npx tsx src/run-worker.ts <P1|P2|P3|ALL>");
  console.log("");
  console.log("  P1  - Run high-priority worker (transactional)");
  console.log("  P2  - Run medium-priority worker");
  console.log("  P3  - Run low-priority worker (marketing)");
  console.log("  ALL - Run all priority workers + iterator");
  process.exit(1);
}

console.log(`\n🚀 Starting notification worker(s): ${arg}\n`);

if (arg === "ALL") {
  const workers = createAllWorkers();
  const iterator = createIteratorWorker();

  console.log("  ✅ P1 worker started (concurrency: 10)");
  console.log("  ✅ P2 worker started (concurrency: 5)");
  console.log("  ✅ P3 worker started (concurrency: 3)");
  console.log("  ✅ Iterator worker started (concurrency: 2)");
  console.log("\n  Press Ctrl+C to stop\n");

  process.on("SIGINT", async () => {
    console.log("\n\n🛑 Shutting down workers...\n");
    await Promise.all(Object.values(workers).map((w) => w.close()));
    await iterator.close();
    process.exit(0);
  });
} else {
  const priority = arg as Priority;
  const worker = createWorker(priority);

  const concurrency = priority === "P1" ? 10 : priority === "P2" ? 5 : 3;
  console.log(`  ✅ ${priority} worker started (concurrency: ${concurrency})`);
  console.log("\n  Press Ctrl+C to stop\n");

  process.on("SIGINT", async () => {
    console.log("\n\n🛑 Shutting down worker...\n");
    await worker.close();
    process.exit(0);
  });
}
