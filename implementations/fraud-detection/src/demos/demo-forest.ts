import { SEED_TRANSACTIONS } from "../fixtures/seed-data.js";
import { extractFeatures } from "../ml/feature-extractor.js";
import {
  trainRandomForest,
  printTreeVotes,
  TREE_FEATURE_SETS,
} from "../ml/random-forest.js";
import type { TrainingSample } from "../types.js";

async function main(): Promise<void> {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║     Random Forest — majority vote across trees           ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  const samples: TrainingSample[] = SEED_TRANSACTIONS.map((s, i) => ({
    txnId: `seed-${i}`,
    label: s.isFraudLabel ? 1 : 0,
    features: extractFeatures(s),
  }));

  console.log("Tree feature subsets (from slides):\n");
  TREE_FEATURE_SETS.forEach((f, i) => {
    console.log(`  tree_${i + 1}: ${f.join(" + ")}`);
  });

  const forest = trainRandomForest(samples);

  const testCases = [
    { name: "Normal UPI", ...SEED_TRANSACTIONS[0] },
    {
      name: "Intl 2am high amount",
      ...SEED_TRANSACTIONS[1],
    },
    {
      name: "Small Grammarly-like",
      sourceAcc: "ACC004",
      targetAcc: "ACC008",
      amount: 49,
      ip: "203.0.113.9",
      region: "IN-TN",
      location: "Chennai",
      targetBank: "GRAMMARLY",
      isInternational: true,
      hourOfDay: 14,
      status: "DONE" as const,
      isFraudLabel: false,
      summary: "",
    },
  ];

  console.log("\nClassifications:\n");
  for (const tc of testCases) {
    const features = extractFeatures(tc);
    const result = forest.classify(features);
    console.log(`  ${tc.name}:`);
    console.log(printTreeVotes(result));
    console.log(
      `  → ${result.isFraud ? "FRAUD" : "LEGIT"} (${(result.confidence * 100).toFixed(0)}% fraud votes, ${result.latencyMs.toFixed(2)}ms)\n`
    );
  }
}

main().catch(console.error);
