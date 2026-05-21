import { cronQueue, addSchedule, listSchedules } from "./queue";

interface DbSchedule {
  id: string;
  taskName: string;
  cronExpression: string;
  payload: Record<string, unknown>;
  enabled: boolean;
}

const MOCK_DB_SCHEDULES: DbSchedule[] = [
  {
    id: "daily-report-1",
    taskName: "daily-report",
    cronExpression: "*/1 * * * *",
    payload: { team: "engineering" },
    enabled: true,
  },
  {
    id: "health-check-1",
    taskName: "health-check",
    cronExpression: "*/1 * * * *",
    payload: { services: ["api", "db", "cache"] },
    enabled: true,
  },
  {
    id: "cleanup-1",
    taskName: "cleanup",
    cronExpression: "*/5 * * * *", // changed from 2 to 5 minutes
    payload: { olderThanDays: 30 },
    enabled: true,
  },
  {
    id: "digest-1",
    taskName: "send-digest",
    cronExpression: "*/3 * * * *",
    payload: { recipients: ["team@example.com"] },
    enabled: false, // disabled
  },
];

async function syncSchedules(dbSchedules: DbSchedule[]) {
  const enabledSchedules = dbSchedules.filter((s) => s.enabled);
  const repeatableJobs = await cronQueue.getRepeatableJobs();

  const desiredIds = new Set(enabledSchedules.map((s) => s.id));

  const existingByScheduleId = new Map<string, { key: string; pattern: string }>();
  const orphaned: string[] = [];

  for (const job of repeatableJobs) {
    const scheduleId = extractScheduleId(job.key);
    if (scheduleId && desiredIds.has(scheduleId)) {
      existingByScheduleId.set(scheduleId, {
        key: job.key,
        pattern: job.pattern ?? "",
      });
    } else {
      orphaned.push(job.key);
    }
  }

  let removed = 0;
  for (const key of orphaned) {
    await cronQueue.removeRepeatableByKey(key);
    removed++;
  }

  let added = 0;
  let updated = 0;
  let unchanged = 0;

  for (const schedule of enabledSchedules) {
    const existing = existingByScheduleId.get(schedule.id);

    if (existing && existing.pattern === schedule.cronExpression) {
      unchanged++;
      continue;
    }

    if (existing) {
      await cronQueue.removeRepeatableByKey(existing.key);
    }

    await addSchedule(
      schedule.id,
      schedule.taskName,
      schedule.cronExpression,
      schedule.payload,
    );

    existing ? updated++ : added++;
  }

  return { total: enabledSchedules.length, added, updated, unchanged, removedOrphans: removed };
}

function extractScheduleId(jobKey: string): string | null {
  const knownIds = ["daily-report-1", "cleanup-1", "health-check-1", "digest-1"];
  for (const id of knownIds) {
    if (jobKey.includes(id)) return id;
  }
  return null;
}

async function run() {
  console.log("🔄 Syncing schedules (database → Redis)...\n");
  console.log("Mock database has these schedules:");
  for (const s of MOCK_DB_SCHEDULES) {
    console.log(`  ${s.enabled ? "✅" : "❌"} ${s.id}: ${s.taskName} @ ${s.cronExpression}`);
  }
  console.log("");

  const before = await listSchedules();
  console.log(`Redis has ${before.length} schedule(s) before sync.\n`);

  const result = await syncSchedules(MOCK_DB_SCHEDULES);

  console.log("📊 Sync results:");
  console.log(`   Total enabled: ${result.total}`);
  console.log(`   Added: ${result.added}`);
  console.log(`   Updated: ${result.updated}`);
  console.log(`   Unchanged: ${result.unchanged}`);
  console.log(`   Orphans removed: ${result.removedOrphans}`);

  const after = await listSchedules();
  console.log(`\nRedis now has ${after.length} schedule(s) after sync.\n`);

  await cronQueue.close();
}

run().catch(console.error);
