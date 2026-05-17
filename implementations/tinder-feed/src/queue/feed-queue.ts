import { Queue, Worker, Job } from "bullmq";
import { redis } from "../connection.js";
import { feedGenerator } from "../feed/generator.js";
import type { FeedGenerationRequest, FeedItem } from "../types.js";

const QUEUE_NAME = "tinder:feed-generation";

export const feedQueue = new Queue<FeedGenerationRequest>(QUEUE_NAME, {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 1000,
    },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
});

export async function enqueueFeedGeneration(
  request: FeedGenerationRequest
): Promise<string> {
  const job = await feedQueue.add("generate-feed", request, {
    jobId: `feed-${request.userId}-${Date.now()}`,
  });
  return job.id!;
}

export function createFeedWorker(
  onComplete?: (userId: string, items: FeedItem[]) => void
): Worker<FeedGenerationRequest, FeedItem[]> {
  const worker = new Worker<FeedGenerationRequest, FeedItem[]>(
    QUEUE_NAME,
    async (job: Job<FeedGenerationRequest>) => {
      const { userId, count, radiusKm } = job.data;

      console.log(`[Worker] Generating feed for user ${userId}...`);

      const items = await feedGenerator.generateFeed({
        userId,
        count,
        radiusKm,
      });

      console.log(`[Worker] Generated ${items.length} feed items for ${userId}`);

      return items;
    },
    {
      connection: redis,
      concurrency: 5,
    }
  );

  worker.on("completed", (job, result) => {
    console.log(
      `[Worker] Job ${job.id} completed: ${result.length} items generated`
    );
    if (onComplete) {
      onComplete(job.data.userId, result);
    }
  });

  worker.on("failed", (job, err) => {
    console.error(`[Worker] Job ${job?.id} failed:`, err.message);
  });

  return worker;
}

export async function getQueueStats(): Promise<{
  waiting: number;
  active: number;
  completed: number;
  failed: number;
}> {
  const [waiting, active, completed, failed] = await Promise.all([
    feedQueue.getWaitingCount(),
    feedQueue.getActiveCount(),
    feedQueue.getCompletedCount(),
    feedQueue.getFailedCount(),
  ]);

  return { waiting, active, completed, failed };
}

export async function closeQueue(): Promise<void> {
  await feedQueue.close();
}
