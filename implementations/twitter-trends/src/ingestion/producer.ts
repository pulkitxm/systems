import { v4 as uuidv4 } from "uuid";
import { KAFKA_TOPICS } from "../config.js";
import { kafka } from "../connection.js";
import { extractUrls } from "../utils.js";
import type { Tweet } from "../types.js";
import { storeTweet } from "./tweet-store.js";

const producer = kafka.producer();

export async function connectProducer(): Promise<void> {
  await producer.connect();
}

export async function disconnectProducer(): Promise<void> {
  await producer.disconnect();
}

let producerConnected = false;

async function ensureProducer(): Promise<boolean> {
  if (producerConnected) return true;
  try {
    await producer.connect();
    producerConnected = true;
    return true;
  } catch {
    return false;
  }
}

export async function publishTweet(tweet: Tweet): Promise<void> {
  await storeTweet(tweet);
  if (process.env.SKIP_KAFKA === "1") return;

  const ok = await ensureProducer();
  if (!ok) return;

  try {
    await producer.send({
      topic: KAFKA_TOPICS.TWEETS_PUBLISHED,
      messages: [
        {
          key: tweet.userId,
          value: JSON.stringify(tweet),
        },
      ],
    });
  } catch {
    // Demos run in-process; Kafka optional when broker is down
  }
}

export function createTweet(
  userId: string,
  text: string,
  opts?: Partial<Pick<Tweet, "isReply" | "isSensitive" | "urls">>
): Tweet {
  const urls = opts?.urls ?? extractUrls(text);
  return {
    id: uuidv4(),
    userId,
    text,
    urls: urls.length ? urls : undefined,
    isReply: opts?.isReply,
    isSensitive: opts?.isSensitive,
    createdAt: new Date().toISOString(),
  };
}

export async function publishTweets(tweets: Tweet[]): Promise<void> {
  for (const t of tweets) {
    await publishTweet(t);
  }
}
