import type { ConnectionOptions } from "bullmq";

export function createConnection(): ConnectionOptions {
  return {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379", 10),
    maxRetriesPerRequest: null,
  };
}
