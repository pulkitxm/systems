import { Queue, QueueEvents } from "bullmq";
import { redis, type Priority, type NotificationMessage, type BulkNotificationJob } from "./connection.js";

const QUEUE_NAMES: Record<Priority, string> = {
  P1: "notifications:p1",
  P2: "notifications:p2",
  P3: "notifications:p3",
};

const BULK_QUEUE_NAME = "notifications:bulk";

const queues: Record<Priority, Queue> = {
  P1: new Queue(QUEUE_NAMES.P1, { connection: redis }),
  P2: new Queue(QUEUE_NAMES.P2, { connection: redis }),
  P3: new Queue(QUEUE_NAMES.P3, { connection: redis }),
};

const bulkQueue = new Queue(BULK_QUEUE_NAME, { connection: redis });

export async function enqueueNotification(
  message: NotificationMessage,
  priority: Priority
): Promise<string> {
  const job = await queues[priority].add("send", message, {
    removeOnComplete: 100,
    removeOnFail: 1000,
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 1000,
    },
  });
  return job.id ?? message.id;
}

export async function enqueueBulkJob(job: BulkNotificationJob): Promise<string> {
  const result = await bulkQueue.add("bulk", job, {
    removeOnComplete: 10,
    removeOnFail: 100,
  });
  return result.id ?? job.id;
}

export async function getQueueStats(priority: Priority): Promise<{
  waiting: number;
  active: number;
  completed: number;
  failed: number;
}> {
  const q = queues[priority];
  const [waiting, active, completed, failed] = await Promise.all([
    q.getWaitingCount(),
    q.getActiveCount(),
    q.getCompletedCount(),
    q.getFailedCount(),
  ]);
  return { waiting, active, completed, failed };
}

export async function getAllQueueStats(): Promise<Record<Priority, Awaited<ReturnType<typeof getQueueStats>>>> {
  const [p1, p2, p3] = await Promise.all([
    getQueueStats("P1"),
    getQueueStats("P2"),
    getQueueStats("P3"),
  ]);
  return { P1: p1, P2: p2, P3: p3 };
}

export async function drainQueues(): Promise<void> {
  await Promise.all([
    queues.P1.drain(),
    queues.P2.drain(),
    queues.P3.drain(),
    bulkQueue.drain(),
  ]);
}

export function getQueue(priority: Priority): Queue {
  return queues[priority];
}

export function getBulkQueue(): Queue {
  return bulkQueue;
}

export function getQueueName(priority: Priority): string {
  return QUEUE_NAMES[priority];
}

export const BULK_QUEUE = BULK_QUEUE_NAME;
