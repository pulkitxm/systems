import { Queue } from "bullmq";
import { createConnection } from "./connection";

export interface CronJobData {
  scheduleId: string;
  taskName: string;
  payload: Record<string, unknown>;
}

export const QUEUE_NAME = "cron-jobs";

export const cronQueue = new Queue<CronJobData>(QUEUE_NAME, {
  connection: createConnection(),
  defaultJobOptions: {
    removeOnComplete: 50,
    removeOnFail: 25,
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 3000,
    },
  },
});

export async function addSchedule(
  scheduleId: string,
  taskName: string,
  cronExpression: string,
  payload: Record<string, unknown> = {},
) {
  const job = await cronQueue.add(
    taskName,
    { scheduleId, taskName, payload },
    {
      repeat: {
        pattern: cronExpression,
        tz: "UTC",
      },
      jobId: scheduleId,
    },
  );

  return {
    id: job.id,
    repeatJobKey: job.repeatJobKey,
    name: job.name,
  };
}

export async function removeSchedule(repeatJobKey: string) {
  const removed = await cronQueue.removeRepeatableByKey(repeatJobKey);
  return removed;
}

export async function listSchedules() {
  const jobs = await cronQueue.getRepeatableJobs();
  return jobs.map((job) => ({
    key: job.key,
    name: job.name,
    pattern: job.pattern,
    next: job.next ? new Date(job.next) : null,
    tz: job.tz,
  }));
}
