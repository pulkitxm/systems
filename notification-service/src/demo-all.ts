import { cleanup, redis } from "./connection.js";
import { createTemplate, listTemplates } from "./template.js";
import { sendSingleNotification, sendBulkNotification } from "./control-service.js";
import { createAllWorkers, getWorkerStats, resetWorkerStats } from "./worker.js";
import { createIteratorWorker, getIteratorStats, resetIteratorStats } from "./iterator.js";
import { drainQueues, getAllQueueStats } from "./queue.js";
import { getBloomFilterInfo, deleteBloomFilter } from "./bloom-filter.js";
import { header, subheader, sleep, printStats } from "./utils.js";

async function main() {
  header("Complete Notification Service Demo");

  console.log(`
This demo walks through the entire notification service architecture:

1. Template Management - Create reusable notification templates
2. Single Notification - Send to one user (transactional)
3. Bulk Notification - Send to many users (marketing campaign)
4. Priority Handling - P1 > P2 > P3 queue processing
5. Deduplication - Bloom filters prevent duplicates
`);

  await redis.flushdb();
  console.log("\n  🧹 Cleared Redis for fresh demo\n");

  subheader("Step 1: Create Notification Templates");

  const templates = {
    orderConfirmation: await createTemplate(
      "email",
      "Order Confirmed - #{{orderNumber}}",
      `Hi {{user.name}},

Your order #{{orderNumber}} has been confirmed!

Items: {{items}}
Total: {{total}}
Delivery: {{deliveryDate}}

Track your order: {{trackingUrl}}`,
      ["user.name", "orderNumber", "items", "total", "deliveryDate", "trackingUrl"]
    ),

    otpCode: await createTemplate(
      "sms",
      undefined,
      "{{user.name}}, your verification code is {{code}}. Valid for {{validity}} minutes.",
      ["user.name", "code", "validity"]
    ),

    flashSale: await createTemplate(
      "email",
      "🔥 {{discount}}% OFF - Today Only!",
      `Hey {{user.name}}!

Don't miss our flash sale - {{discount}}% off everything!

Use code: {{promoCode}}
Expires: {{expiry}}

Shop now: {{shopUrl}}`,
      ["user.name", "discount", "promoCode", "expiry", "shopUrl"]
    ),

    appUpdate: await createTemplate(
      "push_android",
      undefined,
      "{{user.name}}, a new version is available! Update now for {{feature}}.",
      ["user.name", "feature"]
    ),
  };

  console.log("\n  Created templates:");
  for (const [name, tmpl] of Object.entries(templates)) {
    console.log(`    ${name}: ${tmpl.id} (${tmpl.channel})`);
  }

  subheader("Step 2: Start Workers");

  const workers = createAllWorkers();
  const iteratorWorker = createIteratorWorker();

  console.log(`
  Started workers:
    P1 (High Priority): 10 concurrent - for OTPs, payments
    P2 (Medium Priority): 5 concurrent - for order updates
    P3 (Low Priority): 3 concurrent - for marketing
    Iterator: 2 concurrent - for bulk job expansion
`);

  await sleep(500);
  resetWorkerStats();
  resetIteratorStats();

  subheader("Step 3: Send Transactional Notifications (P1)");

  console.log("\n  Scenario: User requesting OTP for login\n");

  await sendSingleNotification({
    userId: "user_002",
    templateId: templates.otpCode.id,
    variables: {
      code: "847291",
      validity: "5",
    },
    channel: "sms",
    priority: "P1",
  });

  await sleep(1500);

  subheader("Step 4: Send Order Confirmation (P2)");

  console.log("\n  Scenario: User placed an order\n");

  await sendSingleNotification({
    userId: "user_003",
    templateId: templates.orderConfirmation.id,
    variables: {
      orderNumber: "ORD-98765",
      items: "1x Laptop, 2x USB-C Cable",
      total: "$1,249.99",
      deliveryDate: "May 7, 2026",
      trackingUrl: "https://track.example.com/ORD-98765",
    },
    channel: "email",
    priority: "P2",
  });

  await sleep(1500);

  subheader("Step 5: Launch Marketing Campaign (P3)");

  const campaignId = `flash_sale_${Date.now()}`;

  console.log(`\n  Scenario: Flash sale notification to San Francisco users\n`);

  await sendBulkNotification({
    templateId: templates.flashSale.id,
    campaignId,
    filters: { city: "San Francisco" },
    variables: {
      discount: "40",
      promoCode: "SF40",
      expiry: "midnight tonight",
      shopUrl: "https://shop.example.com/sale",
    },
    channel: "email",
    priority: "P3",
  });

  console.log("\n  ⏳ Processing bulk campaign...\n");
  await sleep(4000);

  subheader("Step 6: Concurrent P1 During Campaign");

  console.log("\n  Scenario: Payment confirmation while campaign runs\n");

  await sendSingleNotification({
    userId: "user_001",
    templateId: templates.orderConfirmation.id,
    variables: {
      orderNumber: "ORD-11111",
      items: "Premium Subscription",
      total: "$99.99",
      deliveryDate: "Instant",
      trackingUrl: "https://account.example.com/subscription",
    },
    channel: "email",
    priority: "P1",
  });

  await sleep(2000);

  subheader("Step 7: Verify Deduplication");

  console.log("\n  Simulating campaign restart (would cause duplicates without Bloom filter)\n");

  await sendBulkNotification({
    templateId: templates.flashSale.id,
    campaignId,
    filters: { city: "San Francisco" },
    variables: {
      discount: "40",
      promoCode: "SF40",
      expiry: "midnight tonight",
      shopUrl: "https://shop.example.com/sale",
    },
    channel: "email",
    priority: "P3",
  });

  await sleep(3000);

  subheader("Final Statistics");

  const workerStats = getWorkerStats();
  console.log("\n📊 Worker Statistics (by priority):");
  for (const [priority, stats] of Object.entries(workerStats)) {
    console.log(`  ${priority}: sent=${stats.succeeded}, failed=${stats.failed}, avgLatency=${stats.avgLatencyMs.toFixed(0)}ms`);
  }

  const iteratorStats = getIteratorStats();
  console.log("\n📊 Iterator Statistics:");
  console.log(`  Jobs processed: ${iteratorStats.jobsProcessed}`);
  console.log(`  Users iterated: ${iteratorStats.usersIterated}`);
  console.log(`  Notifications enqueued: ${iteratorStats.notificationsEnqueued}`);
  console.log(`  Skipped (duplicates): ${iteratorStats.skippedDuplicate}`);

  const queueStats = await getAllQueueStats();
  console.log("\n📊 Queue Status:");
  for (const [priority, stats] of Object.entries(queueStats)) {
    console.log(`  ${priority}: completed=${stats.completed}, failed=${stats.failed}`);
  }

  const bloomInfo = await getBloomFilterInfo(campaignId);
  if (bloomInfo?.exists) {
    console.log("\n📊 Bloom Filter (deduplication):");
    console.log(`  Campaign: ${campaignId}`);
    console.log(`  Items tracked: ${bloomInfo.insertedCount}`);
  }

  console.log(`

Architecture Summary:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
┌─────────────┐     ┌──────────┐     ┌─────────────────────┐
│   Control   │────▶│  Queues  │────▶│      Workers        │
│   Service   │     │ P1/P2/P3 │     │ (send via Resend,   │
└─────────────┘     └──────────┘     │  Twilio, Firebase)  │
      │                              └─────────────────────┘
      │ bulk jobs
      ▼
┌─────────────┐     ┌──────────┐
│   Iterator  │────▶│  Bloom   │
│   Workers   │     │  Filter  │
└─────────────┘     └──────────┘
      │
      │ reads from
      ▼
┌─────────────┐
│   Users DB  │
│  (replica)  │
└─────────────┘

Key Takeaways:
• P1 notifications processed immediately (not blocked by P3)
• Bulk campaigns don't overwhelm the control service
• Bloom filter prevented duplicate sends on retry
• Each component scales independently
`);

  console.log("\n🧹 Cleaning up...\n");

  await deleteBloomFilter(campaignId);
  await iteratorWorker.close();
  await Promise.all(Object.values(workers).map((w) => w.close()));
  await drainQueues();
  await cleanup();

  console.log("✅ Demo complete!\n");
}

main().catch(console.error);
