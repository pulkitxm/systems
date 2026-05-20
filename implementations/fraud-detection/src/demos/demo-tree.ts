import { buildDecisionTree, describeTree } from "../ml/decision-tree.js";
import { extractFeatures } from "../ml/feature-extractor.js";
import type { TrainingSample } from "../types.js";

const samples: TrainingSample[] = [
  {
    txnId: "1",
    label: 0,
    features: extractFeatures({
      sourceAcc: "A",
      targetAcc: "B",
      amount: 500,
      ip: "1",
      region: "IN-MH",
      location: "Mumbai",
      targetBank: "HDFC",
      isInternational: false,
    }),
  },
  {
    txnId: "2",
    label: 1,
    features: extractFeatures({
      sourceAcc: "A",
      targetAcc: "B",
      amount: 90000,
      ip: "1",
      region: "IN-MH",
      location: "Mumbai",
      targetBank: "CHASE",
      isInternational: true,
      hourOfDay: 2,
    }),
  },
  {
    txnId: "3",
    label: 0,
    features: extractFeatures({
      sourceAcc: "A",
      targetAcc: "C",
      amount: 1200,
      ip: "1",
      region: "IN-MH",
      location: "Mumbai",
      targetBank: "SBI",
      isInternational: false,
      hourOfDay: 14,
    }),
  },
  {
    txnId: "4",
    label: 1,
    features: extractFeatures({
      sourceAcc: "B",
      targetAcc: "D",
      amount: 75000,
      ip: "2",
      region: "IN-MH",
      location: "Mumbai",
      targetBank: "BARCLAYS",
      isInternational: true,
      hourOfDay: 3,
    }),
  },
];

async function main(): Promise<void> {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║     Decision Tree — entropy splits, classify             ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  const features: (keyof TrainingSample["features"])[] = [
    "amount",
    "is_international",
    "hour_of_day",
  ];

  const root = buildDecisionTree(samples, features);

  console.log("Tree structure (if feature <= threshold → left, else right):\n");
  for (const line of describeTree(root)) {
    console.log(line);
  }

  console.log("\nExample rules the tree might learn:");
  console.log("  • amount > 50000 at 2am + international → FRAUD");
  console.log("  • small domestic daytime transfer → LEGIT");
}

main().catch(console.error);
