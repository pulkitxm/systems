import { cleanup } from "./connection.js";
import { createTemplate } from "./template.js";
import { sendSingleNotification, sendBulkNotification } from "./control-service.js";
import { createAllWorkers, getWorkerStats, resetWorkerStats } from "./worker.js";
import { createIteratorWorker } from "./iterator.js";
import { drainQueues, getAllQueueStats } from "./queue.js";
import { header, subheader, sleep, printStats } from "./utils.js";

async function main() {
  header("Demo: Priority Queues - Preventing Starvation");

  console.log(`
This demo shows how priority queues prevent marketing campaigns
from blocking transactional notifications.

We'll:
1. Start a bulk marketing campaign (P3 - Low priority)
2. While it's processing, send a transactional notification (P1 - High priority)
3. Observe that P1 notifications are processed immediately
`);

  console.log("\n1️⃣  Creating templates...\n");

  const marketingTemplate = await createTemplate(
    "email",
    "Weekly Newsletter",
    `Hello {{user.name}},

Here's your weekly digest of what's happening!

{{content}}

Unsubscribe: {{unsubUrl}}`,
    ["user.name", "content", "unsubUrl"]
  );

  const transactionalTemplate = await createTemplate(
    "email",
    "Payment Confirmed - ${{amount}}",
    `Hi {{user.name}},

Your payment of \${{amount}} has been processed successfully.

Transaction ID: {{transactionId}}
Date: {{date}}

Thank you!`,
    ["user.name", "amount", "transactionId", "date"]
  );

  console.log(`  Marketing template: ${marketingTemplate.id}`);
  console.log(`  Transactional template: ${transactionalTemplate.id}`);

  console.log("\n2️⃣  Starting workers with different concurrency...\n");
  console.log("  P1 (High): 10 concurrent workers");
  console.log("  P2 (Medium): 5 concurrent workers");
  console.log("  P3 (Low): 3 concurrent workers");

  const workers = createAllWorkers();
  const iteratorWorker = createIteratorWorker();

  await sleep(500);

  resetWorkerStats();

  subheader("Phase 1: Start bulk marketing campaign (P3)");

  const campaignId = `campaign_newsletter_${Date.now()}`;

  await sendBulkNotification({
    templateId: marketingTemplate.id,
    campaignId,
    filters: {},
    variables: {
      content: "Check out our latest products and deals!",
      unsubUrl: "https://example.com/unsubscribe",
    },
    channel: "email",
    priority: "P3",
  });

  console.log("\n  ⏳ Marketing campaign started, flooding P3 queue...");

  await sleep(1000);

  subheader("Phase 2: Send transactional notification (P1)");

  console.log("\n  A user just made a payment - this needs to go out NOW!\n");

  const txnResult = await sendSingleNotification({
    userId: "user_001",
    templateId: transactionalTemplate.id,
    variables: {
      amount: "499.99",
      transactionId: "TXN-" + Date.now(),
      date: new Date().toISOString(),
    },
    channel: "email",
    priority: "P1",
  });

  console.log(`\n  P1 notification enqueued: ${txnResult.jobId}`);

  console.log("\n  ⏳ Observing processing order...\n");

  await sleep(3000);

  subheader("Results");

  const workerStats = getWorkerStats();
  console.log("\n📊 Worker Statistics:");
  for (const [priority, stats] of Object.entries(workerStats)) {
    console.log(`  ${priority}: processed=${stats.processed}, succeeded=${stats.succeeded}, avgLatency=${stats.avgLatencyMs.toFixed(0)}ms`);
  }

  const queueStats = await getAllQueueStats();
  console.log("\n📊 Queue Status:");
  for (const [priority, stats] of Object.entries(queueStats)) {
    console.log(`  ${priority}: waiting=${stats.waiting}, active=${stats.active}, completed=${stats.completed}`);
  }

  console.log(`
Key Observation:
- P1 (transactional) notification was processed immediately
- P3 (marketing) notifications continue processing in background
- The payment confirmation wasn't blocked by marketing messages!
`);

  console.log("\n🧹 Cleaning up...\n");

  await iteratorWorker.close();
  await Promise.all(Object.values(workers).map((w) => w.close()));
  await drainQueues();
  await cleanup();

  console.log("✅ Demo complete!\n");
}

main().catch(console.error);
