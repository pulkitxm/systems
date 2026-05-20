import { rm, mkdir } from "fs/promises";
import { PATHS, FRAUD_SLA_MS } from "../config.js";
import { SEED_TRANSACTIONS, LIVE_TRANSACTIONS } from "../fixtures/seed-data.js";
import { getTransactionDb, closeTransactionDb, insertTransaction, updateTransactionStatus } from "../db/transaction-db.js";
import { getCustomerSupportDb, closeCustomerSupportDb, insertTicket } from "../db/customer-support-db.js";
import { runEtlJob } from "../pipeline/etl-job.js";
import { runTrainJob } from "../pipeline/train-job.js";
import { bootFraudDetectionService } from "../service/fraud-detection-service.js";
import { processTransaction } from "../bank-api/transaction-handler.js";
import { buildDecisionTree, describeTree } from "../ml/decision-tree.js";
import { extractFeatures } from "../ml/feature-extractor.js";
import { trainRandomForest, printTreeVotes } from "../ml/random-forest.js";
import type { TrainingSample } from "../types.js";

async function main(): Promise<void> {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║     Fraud Detection — Full System Design Demo             ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  await rm(PATHS.dataDir, { recursive: true, force: true });
  await mkdir(PATHS.dataDir, { recursive: true });
  await mkdir(PATHS.s3Training, { recursive: true });
  await mkdir(PATHS.s3Models, { recursive: true });

  getTransactionDb();
  getCustomerSupportDb();

  console.log("1. Storage — transaction DB + customer support DB\n");
  for (const seed of SEED_TRANSACTIONS) {
    const txn = insertTransaction(seed, seed.status);
    updateTransactionStatus(txn.txnId, seed.status);
    insertTicket(txn.txnId, seed.isFraudLabel, seed.summary);
  }
  console.log(`   Seeded ${SEED_TRANSACTIONS.length} labeled transactions\n`);

  console.log("2. Decision tree (single tree, entropy)\n");
  const miniSamples: TrainingSample[] = SEED_TRANSACTIONS.slice(0, 6).map(
    (s, i) => ({
      txnId: `m-${i}`,
      label: s.isFraudLabel ? 1 : 0,
      features: extractFeatures(s),
    })
  );
  const miniTree = buildDecisionTree(miniSamples, [
    "amount",
    "is_international",
    "hour_of_day",
  ]);
  console.log(describeTree(miniTree).slice(0, 5).map((l) => `   ${l}`).join("\n"));
  console.log("   ...\n");

  console.log("3. Spark ETL → S3 (multiple JSON shards)\n");
  const etl = await runEtlJob();
  console.log(`   ${etl.totalRecords} records → ${etl.shardsWritten} shard(s)\n`);

  console.log("4. Spark + MLlib → train Random Forest → S3 model\n");
  const train = await runTrainJob();
  console.log(`   Model: ${train.modelPath} (${train.treeCount} trees)\n`);

  await bootFraudDetectionService();
  console.log("5. Fraud detection service booted (model loaded from S3)\n");
  console.log(`   SLA: < ${FRAUD_SLA_MS}ms per classification\n`);

  console.log("6. Live transactions via Bank API (sync fraud check)\n");
  for (const req of LIVE_TRANSACTIONS) {
    const result = await processTransaction(req);
    console.log(
      `   ₹${req.amount.toLocaleString()} ${req.isInternational ? "intl" : "domestic"} → ${result.status}`
    );
    console.log(printTreeVotes(result.fraudCheck).replace(/^/gm, "     "));
    console.log(
      `     ${result.fraudCheck.latencyMs.toFixed(2)}ms — ${result.fraudCheck.isFraud ? "CS will call customer" : "completed"}\n`
    );
  }

  console.log("7. Flow recap");
  console.log("   User → Bank API → register INITIATED → sync fraud check");
  console.log("   FRAUD → hold + notify CS → user YES/NO → ALLOWED or FAILED");
  console.log("   LEGIT → DONE");
  console.log("   Training: CS DB + Txn DB → Spark ETL → S3 → MLlib → model on S3");

  closeTransactionDb();
  closeCustomerSupportDb();
}

main().catch(console.error);
