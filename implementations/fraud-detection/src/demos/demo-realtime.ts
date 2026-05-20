import { LIVE_TRANSACTIONS, SEED_TRANSACTIONS } from "../fixtures/seed-data.js";
import { insertTransaction, updateTransactionStatus } from "../db/transaction-db.js";
import { insertTicket } from "../db/customer-support-db.js";
import { runEtlJob } from "../pipeline/etl-job.js";
import { runTrainJob } from "../pipeline/train-job.js";
import {
  ensureFraudServiceBooted,
} from "../bank-api/transaction-handler.js";
import { processTransaction } from "../bank-api/transaction-handler.js";
import { printTreeVotes } from "../ml/random-forest.js";
import { FRAUD_SLA_MS } from "../config.js";
import {
  closeTransactionDb,
  getTransactionDb,
} from "../db/transaction-db.js";
import { closeCustomerSupportDb, getCustomerSupportDb } from "../db/customer-support-db.js";

async function main(): Promise<void> {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║     Real-time Flow — Bank API → Fraud Service (<200ms)   ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  getTransactionDb();
  getCustomerSupportDb();

  for (const seed of SEED_TRANSACTIONS) {
    const txn = insertTransaction(seed, seed.status);
    updateTransactionStatus(txn.txnId, seed.status);
    insertTicket(txn.txnId, seed.isFraudLabel, seed.summary);
  }

  await runEtlJob();
  await runTrainJob();
  await ensureFraudServiceBooted();

  console.log(`SLA: fraud detection must respond within ${FRAUD_SLA_MS}ms\n`);

  for (const req of LIVE_TRANSACTIONS) {
    console.log(
      `Transfer ${req.sourceAcc} → ${req.targetAcc}  ₹${req.amount.toLocaleString()}` +
        `${req.isInternational ? " (international)" : ""}`
    );

    const result = await processTransaction(req);

    console.log(printTreeVotes(result.fraudCheck));
    console.log(
      `  Status: ${result.status} | ${result.fraudCheck.latencyMs.toFixed(2)}ms`
    );
    console.log(`  ${result.message}\n`);
  }

  closeTransactionDb();
  closeCustomerSupportDb();
}

main().catch(console.error);
