import { cleanup } from "./connection.js";
import { createTemplate } from "./template.js";
import { sendSingleNotification } from "./control-service.js";
import { createWorker } from "./worker.js";
import { drainQueues } from "./queue.js";
import { header, sleep } from "./utils.js";

async function main() {
  header("Demo: Single User Notification");

  console.log("\n1️⃣  Creating notification template...\n");

  const template = await createTemplate(
    "email",
    "Your order is confirmed!",
    `Hello {{user.name}},

Your order #{{orderNumber}} has been confirmed!

Items: {{items}}
Total: {{total}}

Thank you for shopping with us!`,
    ["user.name", "orderNumber", "items", "total"]
  );

  console.log(`  Created template: ${template.id}`);
  console.log(`  Channel: ${template.channel}`);
  console.log(`  Variables: ${template.variables.join(", ")}`);

  console.log("\n2️⃣  Starting P1 worker...\n");

  const worker = createWorker("P1");

  await sleep(500);

  console.log("\n3️⃣  Sending notification via Control Service...\n");

  const result = await sendSingleNotification({
    userId: "user_001",
    templateId: template.id,
    variables: {
      orderNumber: "ORD-12345",
      items: "2x Widget, 1x Gadget",
      total: "$149.99",
    },
    channel: "email",
    priority: "P1",
  });

  if (result.success) {
    console.log(`\n  Job ID: ${result.jobId}`);
  } else {
    console.log(`\n  Error: ${result.error}`);
  }

  console.log("\n4️⃣  Waiting for worker to process...\n");

  await sleep(2000);

  console.log("\n5️⃣  Cleaning up...\n");

  await worker.close();
  await drainQueues();
  await cleanup();

  console.log("\n✅ Demo complete!\n");
}

main().catch(console.error);
