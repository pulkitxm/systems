import { listSchedules, removeSchedule, cronQueue } from "./queue";

async function run() {
  const key = process.argv[2];

  if (!key) {
    console.log("Usage: pnpm run remove-schedule <repeat-job-key>\n");
    console.log("Active schedules:\n");

    const schedules = await listSchedules();
    for (const schedule of schedules) {
      console.log(`  ${schedule.name} → ${schedule.key}`);
    }

    if (schedules.length === 0) {
      console.log("  (none)");
    }

    console.log("\nCopy a key from above and run:");
    console.log('  pnpm run remove-schedule "<key>"\n');
  } else {
    const removed = await removeSchedule(key);
    if (removed) {
      console.log(`✅ Removed schedule: ${key}`);
    } else {
      console.log(`❌ Schedule not found: ${key}`);
    }
  }

  await cronQueue.close();
}

run().catch(console.error);
