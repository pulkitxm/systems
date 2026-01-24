/**
 * Redis Bloom Filter Demo
 *
 * This demo shows how to use Bloom filters with Redis (RedisBloom module).
 *
 * Prerequisites:
 * 1. Redis with RedisBloom module running
 *    docker run -p 6379:6379 redis/redis-stack-server:latest
 *
 * 2. Install dependencies:
 *    pnpm install
 */

import Redis from "ioredis";

const redis = new Redis({
  host: "localhost",
  port: 6379,
});

async function main() {
  console.log("=".repeat(60));
  console.log("REDIS BLOOM FILTER DEMO");
  console.log("=".repeat(60));
  console.log();

  try {
    // Check if Redis is connected
    await redis.ping();
    console.log("Connected to Redis!");
    console.log();

    const filterName = "demo:watched_posts";

    // Clean up any existing filter
    await redis.del(filterName);

    // Create a Bloom filter
    // BF.RESERVE key error_rate capacity
    console.log("--- Creating Bloom Filter ---");
    console.log("Command: BF.RESERVE demo:watched_posts 0.01 10000");
    await redis.call("BF.RESERVE", filterName, "0.01", "10000");
    console.log("Created filter with 1% error rate, 10,000 capacity");
    console.log();

    // Add some items
    console.log("--- Adding Items ---");
    const itemsToAdd = ["post_123", "post_456", "post_789", "post_abc"];
    for (const item of itemsToAdd) {
      await redis.call("BF.ADD", filterName, item);
      console.log(`Added: ${item}`);
    }
    console.log();

    // Check existence
    console.log("--- Checking Existence ---");
    const itemsToCheck = [
      "post_123",  // added
      "post_456",  // added
      "post_999",  // not added
      "post_xyz",  // not added
      "post_abc",  // added
    ];

    for (const item of itemsToCheck) {
      const exists = await redis.call("BF.EXISTS", filterName, item);
      const status = exists === 1 ? "MIGHT EXIST" : "DEFINITELY NOT";
      const wasAdded = itemsToAdd.includes(item) ? "(was added)" : "(never added)";
      console.log(`${item}: ${status} ${wasAdded}`);
    }
    console.log();

    // Add multiple items at once
    console.log("--- Adding Multiple Items (BF.MADD) ---");
    const bulkItems = ["user_1", "user_2", "user_3"];
    await redis.call("BF.MADD", filterName, ...bulkItems);
    console.log(`Added ${bulkItems.length} items in one call`);
    console.log();

    // Get filter info
    console.log("--- Filter Info (BF.INFO) ---");
    const info = await redis.call("BF.INFO", filterName);
    console.log("Filter statistics:");
    for (let i = 0; i < info.length; i += 2) {
      console.log(`  ${info[i]}: ${info[i + 1]}`);
    }
    console.log();

    // Real-world simulation: Instagram recommendation
    console.log("--- Real-World Simulation: Instagram Recommendations ---");
    const userFilter = "user:pulkit:watched";
    await redis.del(userFilter);
    await redis.call("BF.RESERVE", userFilter, "0.01", "100000");

    // User watched some reels
    const watchedReels = ["reel_100", "reel_200", "reel_300", "reel_400", "reel_500"];
    for (const reel of watchedReels) {
      await redis.call("BF.ADD", userFilter, reel);
    }
    console.log(`User watched ${watchedReels.length} reels`);
    console.log();

    // Recommendation engine filtering
    const candidates = ["reel_100", "reel_999", "reel_200", "reel_888", "reel_777"];
    console.log("Filtering recommendation candidates:");
    const recommendations: string[] = [];

    for (const reel of candidates) {
      const mightHaveWatched = await redis.call("BF.EXISTS", userFilter, reel);
      if (mightHaveWatched === 0) {
        recommendations.push(reel);
        console.log(`  ${reel}: RECOMMEND (definitely not watched)`);
      } else {
        console.log(`  ${reel}: SKIP (might have watched)`);
      }
    }
    console.log();
    console.log(`Final recommendations: ${recommendations.join(", ")}`);

    // Cleanup
    await redis.del(filterName);
    await redis.del(userFilter);

  } catch (error) {
    if (error instanceof Error && error.message.includes("ECONNREFUSED")) {
      console.error("Could not connect to Redis.");
      console.error("Make sure Redis with RedisBloom is running:");
      console.error("  docker run -p 6379:6379 redis/redis-stack-server:latest");
    } else {
      throw error;
    }
  } finally {
    await redis.quit();
  }

  console.log();
  console.log("=".repeat(60));
  console.log("REDIS BLOOM FILTER COMMANDS:");
  console.log("  BF.RESERVE key error_rate capacity  - Create filter");
  console.log("  BF.ADD key item                     - Add item");
  console.log("  BF.MADD key item1 item2 ...         - Add multiple items");
  console.log("  BF.EXISTS key item                  - Check if item might exist");
  console.log("  BF.INFO key                         - Get filter statistics");
  console.log("=".repeat(60));
}

main();
