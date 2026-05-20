import { ALLOWED_NEWS_DOMAINS, KAFKA_GROUPS, KAFKA_TOPICS } from "../config.js";
import { kafka as kafkaClient } from "../connection.js";
import { extractUrls, isAllowedNewsDomain } from "../utils.js";
import type { Tweet } from "../types.js";

const consumer = kafkaClient.consumer({ groupId: KAFKA_GROUPS.NEWS_FILTER });
const producer = kafkaClient.producer();

export async function startNewsFilter(): Promise<void> {
  await consumer.connect();
  await producer.connect();
  await consumer.subscribe({ topic: KAFKA_TOPICS.TWEETS_PUBLISHED, fromBeginning: true });

  await consumer.run({
    eachMessage: async ({ message }) => {
      if (!message.value) return;
      const tweet = JSON.parse(message.value.toString()) as Tweet;
      const urls = tweet.urls ?? extractUrls(tweet.text);
      const newsUrls = urls.filter((u) => isAllowedNewsDomain(u, ALLOWED_NEWS_DOMAINS));
      if (newsUrls.length === 0) return;

      const enriched: Tweet = { ...tweet, urls: newsUrls };
      await producer.send({
        topic: KAFKA_TOPICS.TWEETS_NEWS_FILTERED,
        messages: [{ key: tweet.userId, value: JSON.stringify(enriched) }],
      });
    },
  });
}

export async function stopNewsFilter(): Promise<void> {
  await consumer.disconnect();
  await producer.disconnect();
}

/** Process tweets in-memory (for demos without long-running consumers) */
export function filterNewsTweets(tweets: Tweet[]): Tweet[] {
  const result: Tweet[] = [];
  for (const t of tweets) {
    const urls = t.urls ?? extractUrls(t.text);
    const newsUrls = urls.filter((u) => isAllowedNewsDomain(u, ALLOWED_NEWS_DOMAINS));
    if (newsUrls.length > 0) {
      result.push({ ...t, urls: newsUrls });
    }
  }
  return result;
}
