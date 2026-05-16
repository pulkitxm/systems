import { Worker, Job } from "bullmq";
import { redis, type BulkNotificationJob, type NotificationMessage } from "./connection.js";
import { BULK_QUEUE, enqueueNotification } from "./queue.js";
import { getTemplate, populateTemplate } from "./template.js";
import { getUsersFromReplica, getContactInfo } from "./users.js";
import { shouldSendNotification, markAsSent, initBloomFilter } from "./bloom-filter.js";

interface IteratorStats {
  jobsProcessed: number;
  usersIterated: number;
  notificationsEnqueued: number;
  skippedDuplicate: number;
}

const stats: IteratorStats = {
  jobsProcessed: 0,
  usersIterated: 0,
  notificationsEnqueued: 0,
  skippedDuplicate: 0,
};

async function processBulkJob(job: Job<BulkNotificationJob>): Promise<void> {
  const bulkJob = job.data;
  const startTime = Date.now();

  console.log(`\n🔄 Processing bulk job ${bulkJob.id}`);
  console.log(`  Campaign: ${bulkJob.campaignId}`);
  console.log(`  Template: ${bulkJob.templateId}`);
  console.log(`  Filters: ${JSON.stringify(bulkJob.filters)}`);

  const template = await getTemplate(bulkJob.templateId);
  if (!template) {
    throw new Error(`Template ${bulkJob.templateId} not found`);
  }

  await initBloomFilter(bulkJob.campaignId, 100_000, 0.01);

  const users = await getUsersFromReplica(bulkJob.filters);
  console.log(`  Found ${users.length} users matching filters`);

  let enqueued = 0;
  let skipped = 0;

  for (const user of users) {
    stats.usersIterated++;

    const shouldSend = await shouldSendNotification(bulkJob.campaignId, user.id);

    if (!shouldSend) {
      skipped++;
      stats.skippedDuplicate++;
      console.log(`  ⏭️  Skipping ${user.id} (already sent)`);
      continue;
    }

    const body = populateTemplate(template.body, {
      ...bulkJob.variables,
      "user.name": user.name,
    });

    const subject = template.subject
      ? populateTemplate(template.subject, {
          ...bulkJob.variables,
          "user.name": user.name,
        })
      : undefined;

    const message: NotificationMessage = {
      id: `notif_${bulkJob.campaignId}_${user.id}_${Date.now()}`,
      userId: user.id,
      channel: bulkJob.channel,
      body,
      subject,
      contactInfo: getContactInfo(user, bulkJob.channel),
      campaignId: bulkJob.campaignId,
      priority: bulkJob.priority,
      createdAt: Date.now(),
    };

    await enqueueNotification(message, bulkJob.priority);
    await markAsSent(bulkJob.campaignId, user.id);

    enqueued++;
    stats.notificationsEnqueued++;
  }

  stats.jobsProcessed++;

  const elapsed = Date.now() - startTime;
  console.log(`\n✅ Bulk job ${bulkJob.id} completed in ${elapsed}ms`);
  console.log(`  Enqueued: ${enqueued}`);
  console.log(`  Skipped (duplicate): ${skipped}`);
}

export function createIteratorWorker(): Worker<BulkNotificationJob> {
  const worker = new Worker<BulkNotificationJob>(
    BULK_QUEUE,
    async (job) => {
      await processBulkJob(job);
    },
    {
      connection: redis,
      concurrency: 2,
    }
  );

  worker.on("completed", (job) => {
    console.log(`📦 Bulk job ${job.id} completed`);
  });

  worker.on("failed", (job, err) => {
    console.log(`💥 Bulk job ${job?.id} failed: ${err.message}`);
  });

  return worker;
}

export function getIteratorStats(): IteratorStats {
  return { ...stats };
}

export function resetIteratorStats(): void {
  stats.jobsProcessed = 0;
  stats.usersIterated = 0;
  stats.notificationsEnqueued = 0;
  stats.skippedDuplicate = 0;
}
