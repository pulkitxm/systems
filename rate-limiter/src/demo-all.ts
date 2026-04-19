import { redis } from "./connection.js";
import { FixedWindowLimiter } from "./fixed-window.js";
import { SlidingWindowLogLimiter } from "./sliding-window-log.js";
import { SlidingWindowCounterLimiter } from "./sliding-window-counter.js";
import { LeakyBucketLimiter } from "./leaky-bucket.js";
import { fireRequests, header, sleep } from "./utils.js";

async function main(): Promise<void> {
  header("COMPARISON: burst of 8 requests, limit of 5 per 5s");

  const user = "alice";
  await redis.flushdb();

  const fw = new FixedWindowLimiter(redis, 5, 5, "all:fw");
  await fireRequests("fixed-window", 8, () => fw.check(user));

  await redis.flushdb();
  const swl = new SlidingWindowLogLimiter(redis, 5, 5000, "all:swl");
  await fireRequests("sliding-window-log", 8, () => swl.check(user));

  await redis.flushdb();
  const swc = new SlidingWindowCounterLimiter(redis, 5, 5000, "all:swc");
  await fireRequests("sliding-window-counter", 8, () => swc.check(user));

  await redis.flushdb();
  const lb = new LeakyBucketLimiter(redis, 5, 1, "all:lb");
  await fireRequests("leaky-bucket (cap=5, leak=1/s)", 8, () => lb.check(user));

  header("STEADY CADENCE: 1 request per second for 10s, limit 5/5s");
  await redis.flushdb();
  const swc2 = new SlidingWindowCounterLimiter(redis, 5, 5000, "all:swc2");
  await fireRequests("sliding-window-counter", 10, () => swc2.check(user), 1000);

  await redis.quit();
  await sleep(10);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
