import { writeFile, readFile, mkdir } from "fs/promises";
import { join } from "path";
import { FOREST, PATHS } from "../config.js";
import type {
  FeatureVector,
  FraudClassification,
  SerializedForest,
  SerializedTree,
  TrainingSample,
  TreeNode,
} from "../types.js";
import {
  buildDecisionTree,
  classifyTree,
  serializeTree,
} from "./decision-tree.js";

/** Feature subsets per tree (matches slide examples) */
export const TREE_FEATURE_SETS: (keyof FeatureVector)[][] = [
  ["location_code", "hour_of_day"],
  ["region_code", "target_bank_code"],
  ["hour_of_day", "amount", "target_bank_code"],
  ["amount", "is_international"],
  ["region_code", "hour_of_day", "is_international"],
];

export interface RandomForest {
  trees: SerializedTree[];
  classify(features: FeatureVector): FraudClassification;
}

export function trainRandomForest(
  samples: TrainingSample[]
): RandomForest {
  const treeCount = Math.min(FOREST.TREE_COUNT, TREE_FEATURE_SETS.length);
  const trees: SerializedTree[] = [];

  for (let i = 0; i < treeCount; i++) {
    const features = TREE_FEATURE_SETS[i];
    const root = buildDecisionTree(samples, features);
    trees.push(
      serializeTree(`tree_${i + 1}`, features, root)
    );
  }

  return {
    trees,
    classify(features: FeatureVector) {
      const start = performance.now();
      const treeVotes = trees.map((t) => ({
        tree: t.name,
        vote: classifyTree(t.root, features) as 0 | 1,
      }));

      const fraudVotes = treeVotes.filter((v) => v.vote === 1).length;
      const isFraud = fraudVotes > treeVotes.length / 2;
      const confidence = fraudVotes / treeVotes.length;
      const latencyMs = performance.now() - start;

      return {
        isFraud,
        confidence,
        treeVotes,
        latencyMs,
      };
    },
  };
}

export async function saveForestToS3(
  forest: RandomForest
): Promise<string> {
  await mkdir(PATHS.s3Models, { recursive: true });
  const payload: SerializedForest = {
    version: 1,
    trainedAt: Date.now(),
    trees: forest.trees,
  };
  const path = join(PATHS.s3Models, "random-forest.json");
  await writeFile(path, JSON.stringify(payload, null, 2), "utf8");
  return path;
}

export async function loadForestFromS3(): Promise<RandomForest | null> {
  const path = join(PATHS.s3Models, "random-forest.json");
  try {
    const raw = await readFile(path, "utf8");
    const data = JSON.parse(raw) as SerializedForest;
    const trees = data.trees;

    return {
      trees,
      classify(features: FeatureVector) {
        const start = performance.now();
        const treeVotes = trees.map((t) => ({
          tree: t.name,
          vote: classifyTree(t.root, features) as 0 | 1,
        }));
        const fraudVotes = treeVotes.filter((v) => v.vote === 1).length;
        const isFraud = fraudVotes > treeVotes.length / 2;
        return {
          isFraud,
          confidence: fraudVotes / treeVotes.length,
          treeVotes,
          latencyMs: performance.now() - start,
        };
      },
    };
  } catch {
    return null;
  }
}

export function printTreeVotes(
  result: FraudClassification
): string {
  return result.treeVotes
    .map((v) => `  ${v.tree}: ${v.vote === 1 ? "FRAUD" : "LEGIT"}`)
    .join("\n");
}
