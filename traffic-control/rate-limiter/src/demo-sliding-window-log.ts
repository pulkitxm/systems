import { redis } from "./connection.js";
import { SlidingWindowLogLimiter } from "./sliding-window-log.js";
import { fireRequests, header, sleep } from "./utils.js";

async function main(): Promise<void> {
  header("SLIDING WINDOW LOG DEMO");
  console.log("Limit: 5 requests per 5-second rolling window");
  console.log("Tracks exact request timestamps in a Redis sorted set.");

  const limiter = new SlidingWindowLogLimiter(redis, 5, 5000);
  const user = "alice";
  await redis.flushdb();

  await fireRequests("burst", 7, () => limiter.check(user));

  console.log("\nWaiting 2s (still inside the 5s window)...");
  await sleep(2000);
  await fireRequests("still inside window", 3, () => limiter.check(user));

  console.log("\nWaiting 4s so the first requests fall out of the window...");
  await sleep(4000);
  await fireRequests("after partial slide", 5, () => limiter.check(user));

  header("EDGE BURST IS ELIMINATED");
  console.log("Unlike fixed window, you cannot game the boundary.");
  console.log("The window is always 'last N ms from now'.\n");

  await redis.flushdb();
  const edgeLimiter = new SlidingWindowLogLimiter(redis, 5, 5000);

  await fireRequests("fire 5", 5, () => edgeLimiter.check("bob"));
  await sleep(600);
  await fireRequests("try another 5 (rejected, still in window)", 5, () =>
    edgeLimiter.check("bob")
  );

  await redis.quit();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
