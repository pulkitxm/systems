import { Worker, Job } from "bullmq";
import { redis, type Priority, type NotificationMessage } from "./connection.js";
import { getQueueName } from "./queue.js";
import { sendViaProvider } from "./providers.js";
import { markAsSent } from "./bloom-filter.js";

interface WorkerStats {
  processed: number;
  succeeded: number;
  failed: number;
  totalLatencyMs: number;
}

const stats: Record<Priority, WorkerStats> = {
  P1: { processed: 0, succeeded: 0, failed: 0, totalLatencyMs: 0 },
  P2: { processed: 0, succeeded: 0, failed: 0, totalLatencyMs: 0 },
  P3: { processed: 0, succeeded: 0, failed: 0, totalLatencyMs: 0 },
};

async function processNotification(
  job: Job<NotificationMessage>,
  priority: Priority
): Promise<void> {
  const msg = job.data;
  const startTime = Date.now();

  console.log(`\n[${priority}] Processing notification ${msg.id}`);
  console.log(`  User: ${msg.userId}`);
  console.log(`  Channel: ${msg.channel}`);

  const result = await sendViaProvider(
    msg.channel,
    msg.contactInfo,
    msg.body,
    msg.subject
  );

  stats[priority].processed++;
  stats[priority].totalLatencyMs += result.latencyMs;

  if (result.success) {
    stats[priority].succeeded++;
    console.log(`  ✅ Sent via ${result.provider} (${result.latencyMs.toFixed(0)}ms)`);

    if (msg.campaignId) {
      await markAsSent(msg.campaignId, msg.userId);
    }
  } else {
    stats[priority].failed++;
    console.log(`  ❌ Failed: ${result.error}`);
    throw new Error(result.error);
  }
}

export function createWorker(priority: Priority): Worker<NotificationMessage> {
  const queueName = getQueueName(priority);

  const worker = new Worker<NotificationMessage>(
    queueName,
    async (job) => {
      await processNotification(job, priority);
    },
    {
      connection: redis,
      concurrency: priority === "P1" ? 10 : priority === "P2" ? 5 : 3,
    }
  );

  worker.on("completed", (job) => {
    console.log(`  📬 [${priority}] Job ${job.id} completed`);
  });

  worker.on("failed", (job, err) => {
    console.log(`  💥 [${priority}] Job ${job?.id} failed: ${err.message}`);
  });

  return worker;
}

export function createAllWorkers(): Record<Priority, Worker<NotificationMessage>> {
  return {
    P1: createWorker("P1"),
    P2: createWorker("P2"),
    P3: createWorker("P3"),
  };
}

export function getWorkerStats(): Record<Priority, WorkerStats & { avgLatencyMs: number }> {
  const result: Record<Priority, WorkerStats & { avgLatencyMs: number }> = {} as any;

  for (const p of ["P1", "P2", "P3"] as Priority[]) {
    const s = stats[p];
    result[p] = {
      ...s,
      avgLatencyMs: s.processed > 0 ? s.totalLatencyMs / s.processed : 0,
    };
  }

  return result;
}

export function resetWorkerStats(): void {
  for (const p of ["P1", "P2", "P3"] as Priority[]) {
    stats[p] = { processed: 0, succeeded: 0, failed: 0, totalLatencyMs: 0 };
  }
}
