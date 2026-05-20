import { mkdir } from "fs/promises";
import { PATHS, FRAUD_SLA_MS, FOREST } from "../config.js";
import { getTransactionDb, closeTransactionDb } from "../db/transaction-db.js";
import {
  getCustomerSupportDb,
  closeCustomerSupportDb,
} from "../db/customer-support-db.js";

async function main(): Promise<void> {
  console.log("Initializing Fraud Detection System...\n");

  await mkdir(PATHS.dataDir, { recursive: true });
  await mkdir(PATHS.s3Root, { recursive: true });
  await mkdir(PATHS.s3Training, { recursive: true });
  await mkdir(PATHS.s3Models, { recursive: true });

  getTransactionDb();
  console.log("Transaction DB:");
  console.log("  Table: transactions");
  console.log("  Columns: txn_id, source_acc, target_acc, amount, status,");
  console.log("           ip, region, location, target_bank, is_international, hour_of_day");
  console.log("  Statuses: INITIATED | BLOCKED | FRAUD | ALLOWED | DONE | FAILED");
  console.log("  Shard key (prod): source_acc — no FK constraints\n");

  getCustomerSupportDb();
  console.log("Customer Support DB:");
  console.log("  Table: tickets (txn_id, is_fraud, summary) — training labels\n");

  console.log("Fraud Detection Service:");
  console.log(`  SLA: ${FRAUD_SLA_MS}ms synchronous response`);
  console.log(`  Model: Random Forest (${FOREST.TREE_COUNT} trees, entropy splits)\n`);

  console.log("S3 (local):");
  console.log(`  Training: ${PATHS.s3Training}`);
  console.log(`  Models:   ${PATHS.s3Models}`);

  closeTransactionDb();
  closeCustomerSupportDb();
  console.log("\nInit complete.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
