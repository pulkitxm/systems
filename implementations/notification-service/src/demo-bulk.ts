import { cleanup } from "./connection.js";
import { createTemplate } from "./template.js";
import { sendBulkNotification } from "./control-service.js";
import { createAllWorkers } from "./worker.js";
import { createIteratorWorker, getIteratorStats } from "./iterator.js";
import { drainQueues, getAllQueueStats } from "./queue.js";
import { header, sleep, printStats } from "./utils.js";

async function main() {
  header("Demo: Bulk Notification with Iterator");

  console.log("\n1️⃣  Creating marketing template...\n");

  const template = await createTemplate(
    "email",
    "🎉 Flash Sale - 50% Off!",
    `Hey {{user.name}}!

We're running a flash sale just for you!

Use code {{promoCode}} at checkout for {{discount}}% off your next order.

Hurry - offer ends {{expiry}}!

Shop now: {{shopUrl}}`,
    ["user.name", "promoCode", "discount", "expiry", "shopUrl"]
  );

  console.log(`  Created template: ${template.id}`);

  console.log("\n2️⃣  Starting workers...\n");

  const workers = createAllWorkers();
  const iteratorWorker = createIteratorWorker();

  await sleep(500);

  console.log("\n3️⃣  Submitting bulk notification job...\n");

  const campaignId = `campaign_flash_sale_${Date.now()}`;

  const result = await sendBulkNotification({
    templateId: template.id,
    campaignId,
    filters: {
      city: "San Francisco",
    },
    variables: {
      promoCode: "FLASH50",
      discount: "50",
      expiry: "midnight tonight",
      shopUrl: "https://shop.example.com",
    },
    channel: "email",
    priority: "P3",
  });

  if (result.success) {
    console.log(`  Bulk job ID: ${result.jobId}`);
  } else {
    console.log(`  Error: ${result.error}`);
  }

  console.log("\n4️⃣  Waiting for iterator and workers...\n");

  await sleep(5000);

  console.log("\n5️⃣  Checking stats...\n");

  printStats("Iterator Stats", getIteratorStats());

  const queueStats = await getAllQueueStats();
  console.log("\n📊 Queue Stats:");
  for (const [priority, stats] of Object.entries(queueStats)) {
    console.log(`  ${priority}: waiting=${stats.waiting}, completed=${stats.completed}, failed=${stats.failed}`);
  }

  console.log("\n6️⃣  Cleaning up...\n");

  await iteratorWorker.close();
  await Promise.all(Object.values(workers).map((w) => w.close()));
  await drainQueues();
  await cleanup();

  console.log("\n✅ Demo complete!\n");
}

main().catch(console.error);
