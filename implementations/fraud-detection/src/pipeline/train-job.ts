import { loadTrainingSamplesFromS3 } from "./etl-job.js";
import {
  trainRandomForest,
  saveForestToS3,
  type RandomForest,
} from "../ml/random-forest.js";

export interface TrainResult {
  samplesUsed: number;
  treeCount: number;
  modelPath: string;
}

/**
 * Simulates Spark + MLlib: read enriched JSON from S3 → train Random Forest → write model to S3.
 */
export async function runTrainJob(): Promise<TrainResult> {
  const samples = await loadTrainingSamplesFromS3();

  if (samples.length === 0) {
    throw new Error(
      "No training data on S3. Run ETL job first (pnpm demo:pipeline or seed + etl)."
    );
  }

  const forest = trainRandomForest(samples);
  const modelPath = await saveForestToS3(forest);

  return {
    samplesUsed: samples.length,
    treeCount: forest.trees.length,
    modelPath,
  };
}

export async function ensureModelTrained(): Promise<RandomForest> {
  const { runEtlJob } = await import("./etl-job.js");
  const etl = await runEtlJob();
  if (etl.totalRecords === 0) {
    throw new Error("No labeled transactions for training. Run pnpm seed first.");
  }
  await runTrainJob();
  const { loadForestFromS3 } = await import("../ml/random-forest.js");
  const forest = await loadForestFromS3();
  if (!forest) throw new Error("Failed to load trained model from S3");
  return forest;
}
