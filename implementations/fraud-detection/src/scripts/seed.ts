import { SEED_TRANSACTIONS } from "../fixtures/seed-data.js";
import { getTransactionDb, closeTransactionDb } from "../db/transaction-db.js";
import {
  getCustomerSupportDb,
  closeCustomerSupportDb,
  insertTicket,
} from "../db/customer-support-db.js";
import { insertTransaction, updateTransactionStatus } from "../db/transaction-db.js";

async function main(): Promise<void> {
  getTransactionDb();
  getCustomerSupportDb();

  console.log("Seeding historical transactions + CS tickets...\n");

  for (const seed of SEED_TRANSACTIONS) {
    const txn = insertTransaction(seed, seed.status);
    updateTransactionStatus(txn.txnId, seed.status);
    insertTicket(txn.txnId, seed.isFraudLabel, seed.summary);
    console.log(
      `  ${seed.status.padEnd(6)} ${seed.isFraudLabel ? "FRAUD" : "LEGIT "} — ` +
        `₹${seed.amount.toLocaleString()} ${seed.isInternational ? "(intl)" : "(domestic)"}`
    );
  }

  closeTransactionDb();
  closeCustomerSupportDb();
  console.log(`\nSeeded ${SEED_TRANSACTIONS.length} labeled transactions.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
