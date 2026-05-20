import { SEED_TRANSACTIONS } from "../fixtures/seed-data.js";
import { getTransactionDb, closeTransactionDb, insertTransaction, updateTransactionStatus } from "../db/transaction-db.js";
import { getCustomerSupportDb, closeCustomerSupportDb, insertTicket } from "../db/customer-support-db.js";
import { runEtlJob } from "../pipeline/etl-job.js";
import { runTrainJob } from "../pipeline/train-job.js";
import { loadForestFromS3 } from "../ml/random-forest.js";

async function main(): Promise<void> {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║     Spark Pipeline — ETL → S3 → MLlib train → model      ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  console.log("1. Spark ETL (simulated)\n");
  console.log("   Read: Transaction DB + Customer Support DB");
  console.log("   Join: txn_id → is_fraud label + meta features");
  console.log("   Write: multiple JSON shards to local S3\n");

  getTransactionDb();
  getCustomerSupportDb();
  for (const seed of SEED_TRANSACTIONS) {
    const txn = insertTransaction(seed, seed.status);
    updateTransactionStatus(txn.txnId, seed.status);
    insertTicket(txn.txnId, seed.isFraudLabel, seed.summary);
  }

  const etl = await runEtlJob();
  console.log(`   Shards written: ${etl.shardsWritten}`);
  console.log(`   Records:        ${etl.totalRecords}`);
  console.log(`   Path:           ${etl.outputDir}\n`);

  console.log("2. Spark + MLlib training (simulated)\n");
  const train = await runTrainJob();
  console.log(`   Samples:  ${train.samplesUsed}`);
  console.log(`   Trees:    ${train.treeCount}`);
  console.log(`   Model:    ${train.modelPath}\n`);

  const forest = await loadForestFromS3();
  console.log("3. Model ready for fraud detection servers to load on boot");
  console.log(`   Loaded ${forest?.trees.length ?? 0} decision trees from S3`);

  closeTransactionDb();
  closeCustomerSupportDb();
}

main().catch(console.error);
