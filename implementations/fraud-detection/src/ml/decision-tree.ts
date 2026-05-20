import type {
  FeatureVector,
  SerializedTree,
  TrainingSample,
  TreeNode,
} from "../types.js";
import { FOREST } from "../config.js";

function entropy(labels: (0 | 1)[]): number {
  if (labels.length === 0) return 0;
  const counts = { 0: 0, 1: 0 };
  for (const l of labels) counts[l]++;
  let e = 0;
  for (const c of [counts[0], counts[1]]) {
    if (c === 0) continue;
    const p = c / labels.length;
    e -= p * Math.log2(p);
  }
  return e;
}

function majorityLabel(labels: (0 | 1)[]): 0 | 1 {
  const ones = labels.filter((l) => l === 1).length;
  return ones > labels.length / 2 ? 1 : 0;
}

interface IndexedSample {
  features: FeatureVector;
  label: 0 | 1;
}

export function buildDecisionTree(
  samples: TrainingSample[],
  featureKeys: (keyof FeatureVector)[],
  maxDepth: number = FOREST.MAX_DEPTH,
  minSamplesSplit: number = FOREST.MIN_SAMPLES_SPLIT
): TreeNode {
  const labels = samples.map((s) => s.label);

  if (labels.every((l) => l === labels[0])) {
    return { type: "leaf", label: labels[0] };
  }

  if (samples.length < minSamplesSplit || maxDepth === 0) {
    return { type: "leaf", label: majorityLabel(labels) };
  }

  const parentEntropy = entropy(labels);
  let bestGain = -1;
  let bestFeature: keyof FeatureVector | null = null;
  let bestThreshold = 0;

  for (const feature of featureKeys) {
    const values = samples.map((s) => s.features[feature]);
    const unique = [...new Set(values)].sort((a, b) => a - b);

    for (let i = 0; i < unique.length - 1; i++) {
      const threshold = (unique[i] + unique[i + 1]) / 2;
      const leftLabels: (0 | 1)[] = [];
      const rightLabels: (0 | 1)[] = [];

      for (const s of samples) {
        if (s.features[feature] <= threshold) leftLabels.push(s.label);
        else rightLabels.push(s.label);
      }

      if (leftLabels.length === 0 || rightLabels.length === 0) continue;

      const weighted =
        (leftLabels.length / labels.length) * entropy(leftLabels) +
        (rightLabels.length / labels.length) * entropy(rightLabels);
      const gain = parentEntropy - weighted;

      if (gain > bestGain) {
        bestGain = gain;
        bestFeature = feature;
        bestThreshold = threshold;
      }
    }
  }

  if (bestFeature === null || bestGain <= 0) {
    return { type: "leaf", label: majorityLabel(labels) };
  }

  const leftSamples: TrainingSample[] = [];
  const rightSamples: TrainingSample[] = [];

  for (const s of samples) {
    if (s.features[bestFeature] <= bestThreshold!) {
      leftSamples.push(s);
    } else {
      rightSamples.push(s);
    }
  }

  return {
    type: "split",
    feature: bestFeature,
    threshold: bestThreshold,
    left: buildDecisionTree(
      leftSamples,
      featureKeys,
      maxDepth - 1,
      minSamplesSplit
    ),
    right: buildDecisionTree(
      rightSamples,
      featureKeys,
      maxDepth - 1,
      minSamplesSplit
    ),
  };
}

export function classifyTree(
  root: TreeNode,
  features: FeatureVector
): 0 | 1 {
  let node: TreeNode = root;
  while (node.type === "split") {
    const val = features[node.feature!];
    node = val <= node.threshold! ? node.left! : node.right!;
  }
  return node.label ?? 0;
}

export function describeTree(node: TreeNode, depth = 0): string[] {
  const indent = "  ".repeat(depth);
  if (node.type === "leaf") {
    return [`${indent}→ ${node.label === 1 ? "FRAUD" : "LEGIT"}`];
  }
  return [
    `${indent}if ${node.feature} <= ${node.threshold?.toFixed(2)}`,
    ...describeTree(node.left!, depth + 1),
    `${indent}else`,
    ...describeTree(node.right!, depth + 1),
  ];
}

export function serializeTree(
  name: string,
  features: (keyof FeatureVector)[],
  root: TreeNode
): SerializedTree {
  return { name, features, root };
}
