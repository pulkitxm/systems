import { addSchedule, cronQueue } from "./queue";

const SAMPLE_SCHEDULES = [
  {
    id: "daily-report-1",
    task: "daily-report",
    cron: "*/1 * * * *", // every minute for demo purposes
    payload: { team: "engineering" },
  },
  {
    id: "cleanup-1",
    task: "cleanup",
    cron: "*/2 * * * *", // every 2 minutes
    payload: { olderThanDays: 30 },
  },
  {
    id: "health-check-1",
    task: "health-check",
    cron: "*/1 * * * *", // every minute
    payload: { services: ["api", "db", "cache"] },
  },
  {
    id: "digest-1",
    task: "send-digest",
    cron: "*/3 * * * *", // every 3 minutes
    payload: { recipients: ["team@example.com"] },
  },
];

async function run() {
  console.log("📋 Registering cron schedules...\n");

  for (const schedule of SAMPLE_SCHEDULES) {
    const result = await addSchedule(
      schedule.id,
      schedule.task,
      schedule.cron,
      schedule.payload,
    );

    console.log(`✅ Registered: ${schedule.task}`);
    console.log(`   Schedule ID: ${schedule.id}`);
    console.log(`   Cron: ${schedule.cron}`);
    console.log(`   Repeat Key: ${result.repeatJobKey}`);
    console.log("");
  }

  console.log("🎉 All schedules registered!");
  console.log("💡 Run the worker to start processing: pnpm run worker\n");

  await cronQueue.close();
}

run().catch(console.error);
