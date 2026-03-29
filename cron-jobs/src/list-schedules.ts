import { listSchedules, cronQueue } from "./queue";

async function run() {
  const schedules = await listSchedules();

  if (schedules.length === 0) {
    console.log("📭 No active schedules found.");
    console.log("💡 Run: pnpm run add-schedule\n");
  } else {
    console.log(`📋 Active schedules (${schedules.length}):\n`);

    for (const schedule of schedules) {
      console.log(`  📌 ${schedule.name}`);
      console.log(`     Pattern: ${schedule.pattern}`);
      console.log(`     Next run: ${schedule.next?.toISOString() ?? "unknown"}`);
      console.log(`     Timezone: ${schedule.tz || "UTC"}`);
      console.log(`     Key: ${schedule.key}`);
      console.log("");
    }
  }

  await cronQueue.close();
}

run().catch(console.error);
