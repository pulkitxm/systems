import { Worker, type Job, UnrecoverableError } from "bullmq";
import { createConnection } from "./connection";
import { QUEUE_NAME, cronQueue, type CronJobData } from "./queue";

const worker = new Worker<CronJobData>(
  QUEUE_NAME,
  async (job: Job<CronJobData>) => {
    const { scheduleId, taskName, payload } = job.data;

    console.log(`\n⚙️  Processing job: ${taskName}`);
    console.log(`   Schedule: ${scheduleId}`);
    console.log(`   Attempt: ${job.attemptsMade + 1}/${(job.opts.attempts ?? 1)}`);
    console.log(`   Time: ${new Date().toISOString()}`);

    switch (taskName) {
      case "daily-report": {
        console.log(`   📊 Generating daily report...`);
        await simulateWork(1500);
        console.log(`   ✅ Daily report generated for ${JSON.stringify(payload)}`);
        break;
      }
      case "cleanup": {
        console.log(`   🧹 Running cleanup task...`);
        await simulateWork(800);
        console.log(`   ✅ Cleanup complete`);
        break;
      }
      case "health-check": {
        console.log(`   🏥 Running health check...`);
        await simulateWork(500);
        const healthy = Math.random() > 0.2;
        if (!healthy) {
          throw new Error("Health check failed: service unavailable");
        }
        console.log(`   ✅ All services healthy`);
        break;
      }
      case "send-digest": {
        console.log(`   📧 Sending email digest...`);
        await simulateWork(2000);
        console.log(`   ✅ Digest sent`);
        break;
      }
      default: {
        throw new UnrecoverableError(`Unknown task: ${taskName}`);
      }
    }

    return { success: true, processedAt: new Date().toISOString() };
  },
  {
    connection: createConnection(),
    concurrency: 3,
  },
);

function simulateWork(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

worker.on("completed", (job) => {
  console.log(`   ✅ Job ${job.id} completed (${job.name})`);
});

worker.on("failed", (job, err) => {
  console.error(`   ❌ Job ${job?.id} failed: ${err.message}`);
  if (job) {
    console.error(`   Attempts: ${job.attemptsMade}/${job.opts.attempts ?? 1}`);
  }
});

worker.on("error", (err) => {
  console.error(`Worker error: ${err.message}`);
});

let isShuttingDown = false;

async function shutdown() {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log("\n🛑 Shutting down gracefully...");

  const SHUTDOWN_TIMEOUT = 30_000;

  try {
    await Promise.race([
      worker.close(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Shutdown timeout")), SHUTDOWN_TIMEOUT),
      ),
    ]);
    console.log("✅ Worker stopped cleanly");
  } catch {
    console.warn("⚠️  Shutdown timeout, forcing close");
  } finally {
    await cronQueue.close();
    process.exit(0);
  }
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

console.log("🚀 Worker started, waiting for cron jobs...");
console.log("   Press Ctrl+C to stop\n");
