import {
  getTransaction,
  updateTransactionStatus,
  insertTransaction,
} from "../db/transaction-db.js";
import { insertTicket } from "../db/customer-support-db.js";
import {
  classifyTransaction,
  notifyCustomerSupport,
  bootFraudDetectionService,
  isServiceReady,
} from "../service/fraud-detection-service.js";
import type { TransactionRequest, TransactionResult } from "../types.js";

let booted = false;

export async function ensureFraudServiceBooted(): Promise<void> {
  if (!booted) {
    await bootFraudDetectionService();
    booted = true;
  }
}

/**
 * Bank API / Transaction handler flow:
 * 1. Register txn as INITIATED
 * 2. Extract metadata from request
 * 3. Synchronously call fraud detection (<200ms)
 * 4. If fraud → BLOCKED/FRAUD + notify CS; else → ALLOWED → DONE
 */
export async function processTransaction(
  req: TransactionRequest
): Promise<TransactionResult> {
  if (!isServiceReady()) {
    await ensureFraudServiceBooted();
  }

  const txn = insertTransaction(req, "INITIATED");

  const fraudCheck = classifyTransaction(txn);

  if (fraudCheck.isFraud) {
    updateTransactionStatus(txn.txnId, "BLOCKED");
    updateTransactionStatus(txn.txnId, "FRAUD");
    notifyCustomerSupport(txn.txnId, fraudCheck);
    insertTicket(
      txn.txnId,
      true,
      "Auto-flagged by fraud detection — awaiting customer confirmation"
    );

    return {
      txnId: txn.txnId,
      status: "FRAUD",
      fraudCheck,
      message:
        "Transaction held. Customer support will contact you to verify. Say YES to proceed, NO to abort.",
    };
  }

  updateTransactionStatus(txn.txnId, "ALLOWED");
  updateTransactionStatus(txn.txnId, "DONE");

  return {
    txnId: txn.txnId,
    status: "DONE",
    fraudCheck,
    message: "Transaction approved and completed.",
  };
}

export async function confirmFraudTransaction(
  txnId: string,
  userConfirmed: boolean
): Promise<TransactionResult> {
  const existing = getTransaction(txnId);
  if (!existing) {
    throw new Error(`Transaction not found: ${txnId}`);
  }

  if (userConfirmed) {
    updateTransactionStatus(txnId, "ALLOWED");
    updateTransactionStatus(txnId, "DONE");
    insertTicket(txnId, false, "User confirmed legitimate on CS call");
    return {
      txnId,
      status: "DONE",
      fraudCheck: {
        isFraud: false,
        confidence: 0,
        treeVotes: [],
        latencyMs: 0,
      },
      message: "User confirmed YES — transaction allowed.",
    };
  }

  updateTransactionStatus(txnId, "FAILED");
  insertTicket(txnId, true, "User said NO — transaction aborted");
  return {
    txnId,
    status: "FAILED",
    fraudCheck: {
      isFraud: true,
      confidence: 1,
      treeVotes: [],
      latencyMs: 0,
    },
    message: "User confirmed NO — transaction aborted.",
  };
}
