import { Admin } from "kafkajs";
import { KAFKA_TOPICS } from "../config.js";
import { connectRedis, elasticsearch, kafka, redis } from "../connection.js";
import { ensureClusterIndex } from "../clustering/cluster-store.js";

async function createKafkaTopics(): Promise<void> {
  const admin = kafka.admin();
  await admin.connect();

  const existing = await admin.listTopics();
  const topics = Object.values(KAFKA_TOPICS).filter((t) => !existing.includes(t));

  if (topics.length > 0) {
    await admin.createTopics({
      topics: topics.map((topic) => ({ topic, numPartitions: 3, replicationFactor: 1 })),
    });
    console.log(`Created Kafka topics: ${topics.join(", ")}`);
  } else {
    console.log("Kafka topics already exist");
  }

  await admin.disconnect();
}

async function checkElasticsearch(): Promise<void> {
  const health = await elasticsearch.cluster.health();
  console.log(`Elasticsearch status: ${health.status}`);
  await ensureClusterIndex();
  console.log("Elasticsearch index ready: news-clusters");
}

async function checkRedis(): Promise<void> {
  await connectRedis();
  const pong = await redis.ping();
  console.log(`Redis: ${pong}`);
}

async function main(): Promise<void> {
  console.log("Initializing Twitter Trends infrastructure...\n");

  try {
    await checkRedis();
  } catch (e) {
    console.error("Redis not available. Run: docker compose up -d");
    throw e;
  }

  try {
    await createKafkaTopics();
  } catch (e) {
    console.warn("Kafka init skipped (broker may be starting):", (e as Error).message);
  }

  try {
    await checkElasticsearch();
  } catch (e) {
    console.error("Elasticsearch not available. Run: docker compose up -d");
    throw e;
  }

  console.log("\nInit complete.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
