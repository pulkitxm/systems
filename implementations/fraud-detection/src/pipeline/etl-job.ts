import { mkdir, writeFile, readdir, readFile } from "fs/promises";
import { join } from "path";
import { PATHS, ETL_SHARD_SIZE } from "../config.js";
import { listTransactionsForTraining } from "../db/transaction-db.js";
import { listLabeledTickets } from "../db/customer-support-db.js";
import { extractFeatures } from "../ml/feature-extractor.js";
import type { TrainingSample } from "../types.js";

export interface EtlResult {
  shardsWritten: number;
  totalRecords: number;
  outputDir: string;
}

/**
 * Simulates Apache Spark ETL:
 * Read transaction DB + customer support DB → join → enrich → write multiple JSON shards to S3.
 */
export async function runEtlJob(): Promise<EtlResult> {
  const txns = listTransactionsForTraining();
  const tickets = listLabeledTickets();
  const ticketByTxn = new Map(tickets.map((t) => [t.txnId, t]));

  const enriched: TrainingSample[] = [];

  for (const txn of txns) {
    const ticket = ticketByTxn.get(txn.txnId);
    if (!ticket) continue;

    enriched.push({
      txnId: txn.txnId,
      features: extractFeatures(txn),
      label: ticket.isFraud ? 1 : 0,
    });
  }

  await mkdir(PATHS.s3Training, { recursive: true });

  const shards: TrainingSample[][] = [];
  for (let i = 0; i < enriched.length; i += ETL_SHARD_SIZE) {
    shards.push(enriched.slice(i, i + ETL_SHARD_SIZE));
  }

  if (shards.length === 0 && enriched.length > 0) {
    shards.push(enriched);
  }

  let shardIndex = 0;
  for (const shard of shards) {
    const path = join(
      PATHS.s3Training,
      `part-${String(shardIndex).padStart(4, "0")}.json`
    );
    await writeFile(path, JSON.stringify(shard, null, 2), "utf8");
    shardIndex++;
  }

  if (shardIndex === 0 && enriched.length > 0) {
    const path = join(PATHS.s3Training, "part-0000.json");
    await writeFile(path, JSON.stringify(enriched, null, 2), "utf8");
    shardIndex = 1;
  }

  return {
    shardsWritten: shardIndex,
    totalRecords: enriched.length,
    outputDir: PATHS.s3Training,
  };
}

export async function loadTrainingSamplesFromS3(): Promise<TrainingSample[]> {
  const samples: TrainingSample[] = [];
  let files: string[];
  try {
    files = await readdir(PATHS.s3Training);
  } catch {
    return samples;
  }

  for (const file of files.filter((f) => f.endsWith(".json"))) {
    const raw = await readFile(join(PATHS.s3Training, file), "utf8");
    const batch = JSON.parse(raw) as TrainingSample[];
    samples.push(...batch);
  }

  return samples;
}
