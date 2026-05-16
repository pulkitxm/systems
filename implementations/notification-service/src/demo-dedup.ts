import { cleanup } from "./connection.js";
import { createTemplate } from "./template.js";
import { createIteratorWorker, getIteratorStats, resetIteratorStats } from "./iterator.js";
import { createAllWorkers, resetWorkerStats, getWorkerStats } from "./worker.js";
import { enqueueBulkJob, drainQueues } from "./queue.js";
import { initBloomFilter, getBloomFilterInfo, deleteBloomFilter, demonstrateFalsePositives } from "./bloom-filter.js";
import { header, subheader, sleep, printStats } from "./utils.js";
import type { BulkNotificationJob } from "./connection.js";

async function main() {
  header("Demo: Deduplication with Bloom Filters");

  console.log(`
This demo shows how Bloom filters prevent duplicate notifications
when an iterator crashes and restarts.

Scenario:
1. Start a bulk campaign
2. Process some users
3. Simulate iterator "crash" (restart)
4. Resume campaign - already-sent users are skipped
5. Demonstrate false positive rate
`);

  console.log("\n1️⃣  Creating template...\n");

  const template = await createTemplate(
    "sms",
    undefined,
    "{{user.name}}, flash sale! Use {{code}} for 30% off. Ends today!",
    ["user.name", "code"]
  );

  console.log(`  Template: ${template.id}`);

  const campaignId = `campaign_dedup_demo_${Date.now()}`;

  console.log("\n2️⃣  Initializing Bloom filter for campaign...\n");

  await initBloomFilter(campaignId, 100_000, 0.01);

  const bloomInfo = await getBloomFilterInfo(campaignId);
  if (bloomInfo?.exists) {
    console.log(`  Capacity: ${bloomInfo.capacity?.toLocaleString()}`);
    console.log(`  Items inserted: ${bloomInfo.insertedCount}`);
  }

  console.log("\n3️⃣  Starting workers and iterator...\n");

  const workers = createAllWorkers();
  const iteratorWorker = createIteratorWorker();

  await sleep(500);

  resetIteratorStats();
  resetWorkerStats();

  subheader("Phase 1: First run of the campaign");

  const bulkJob: BulkNotificationJob = {
    id: `bulk_${campaignId}_run1`,
    templateId: template.id,
    campaignId,
    filters: { city: "New York" },
    channel: "sms",
    variables: { code: "FLASH30" },
    priority: "P3",
  };

  await enqueueBulkJob(bulkJob);

  console.log("\n  ⏳ Processing first batch...\n");

  await sleep(3000);

  const statsAfterRun1 = getIteratorStats();
  printStats("After Run 1", statsAfterRun1);

  const bloomInfoAfterRun1 = await getBloomFilterInfo(campaignId);
  console.log(`\n  Bloom filter items: ${bloomInfoAfterRun1?.insertedCount}`);

  subheader("Phase 2: Simulating iterator crash and restart");

  console.log("\n  💥 Iterator crashed! (simulated)");
  console.log("  🔄 Restarting iterator and re-running campaign...\n");

  resetIteratorStats();

  const bulkJobRetry: BulkNotificationJob = {
    id: `bulk_${campaignId}_run2`,
    templateId: template.id,
    campaignId,
    filters: { city: "New York" },
    channel: "sms",
    variables: { code: "FLASH30" },
    priority: "P3",
  };

  await enqueueBulkJob(bulkJobRetry);

  console.log("  ⏳ Processing (should skip already-sent users)...\n");

  await sleep(3000);

  const statsAfterRun2 = getIteratorStats();
  printStats("After Run 2 (Retry)", statsAfterRun2);

  console.log(`
Key Observation:
- Run 1: Sent to ${statsAfterRun1.notificationsEnqueued} users
- Run 2: Skipped ${statsAfterRun2.skippedDuplicate} users (already sent)
- No duplicate notifications!
`);

  subheader("Phase 3: Bloom Filter False Positive Analysis");

  console.log("\n  Testing false positive rate with 1000 fake user IDs...\n");

  const fpResults = await demonstrateFalsePositives(campaignId, 1000);

  console.log(`  Checked: ${fpResults.checked} non-existent users`);
  console.log(`  False positives: ${fpResults.falsePositives}`);
  console.log(`  Observed rate: ${(fpResults.rate * 100).toFixed(3)}%`);
  console.log(`  Expected rate: ~1.00%`);

  console.log(`
Note: False positives mean some users might not receive the
marketing notification (Bloom filter incorrectly says "already sent").
This is acceptable for marketing - we'd rather skip a few users
than annoy anyone with duplicates.
`);

  subheader("Final Statistics");

  const workerStats = getWorkerStats();
  console.log("\n📊 Total notifications sent:");
  let total = 0;
  for (const [priority, stats] of Object.entries(workerStats)) {
    total += stats.succeeded;
    console.log(`  ${priority}: ${stats.succeeded} sent`);
  }
  console.log(`  Total: ${total}`);

  console.log("\n🧹 Cleaning up...\n");

  await deleteBloomFilter(campaignId);
  await iteratorWorker.close();
  await Promise.all(Object.values(workers).map((w) => w.close()));
  await drainQueues();
  await cleanup();

  console.log("✅ Demo complete!\n");
}

main().catch(console.error);
