import { FRAUD_SLA_MS } from "../config.js";
import { extractFeatures } from "../ml/feature-extractor.js";
import {
  loadForestFromS3,
  type RandomForest,
} from "../ml/random-forest.js";
import type {
  FraudClassification,
  Transaction,
  TransactionRequest,
} from "../types.js";

let forest: RandomForest | null = null;

/** Boot: load serialized decision trees from S3 into memory */
export async function bootFraudDetectionService(): Promise<void> {
  forest = await loadForestFromS3();
  if (!forest) {
    throw new Error(
      "No model on S3. Run training pipeline first (demo:pipeline or demo:all)."
    );
  }
}

export function isServiceReady(): boolean {
  return forest !== null;
}

/**
 * HTTP-style fraud check — must respond within 200ms SLA.
 */
export function classifyTransaction(
  txn: Transaction | TransactionRequest
): FraudClassification {
  if (!forest) {
    throw new Error("Fraud detection service not booted. Call bootFraudDetectionService().");
  }

  const features = extractFeatures(txn);
  const result = forest.classify(features);

  if (result.latencyMs > FRAUD_SLA_MS) {
    console.warn(
      `  WARNING: classification took ${result.latencyMs.toFixed(1)}ms (SLA: ${FRAUD_SLA_MS}ms)`
    );
  }

  return result;
}

export function notifyCustomerSupport(
  txnId: string,
  classification: FraudClassification
): void {
  console.log(
    `  [CS] Ticket created for txn ${txnId.slice(0, 8)}… — ` +
      `fraud=${classification.isFraud} (confidence ${(classification.confidence * 100).toFixed(0)}%)`
  );
  console.log(`  [CS] Executive will call customer for verbal confirmation`);
}
