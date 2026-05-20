import { deleteBlob } from "../storage/blob-store.js";
import {
  countExpiredPastes,
  deletePaste,
  getExpiredPastes,
} from "../storage/meta-db.js";
import type { PasteMetadata } from "../types.js";

export interface CleanupResult {
  deleted: number;
  batches: number;
  elapsedMs: number;
}

export async function cleanupExpiredPastes(
  batchSize = 100
): Promise<CleanupResult> {
  const start = Date.now();
  let deleted = 0;
  let batches = 0;

  while (true) {
    const expired = getExpiredPastes(batchSize);
    if (expired.length === 0) break;

    await deleteBatch(expired);
    deleted += expired.length;
    batches += 1;

    if (expired.length < batchSize) break;
  }

  return { deleted, batches, elapsedMs: Date.now() - start };
}

async function deleteBatch(pastes: PasteMetadata[]): Promise<void> {
  for (const paste of pastes) {
    await deleteBlob(paste.ownerId, paste.uid);
    deletePaste(paste.uid);
  }
}

/** Benchmark: delete N expired rows one-by-one vs in batches */
export async function benchmarkBatchDelete(
  totalRows: number,
  batchSizes: number[]
): Promise<Array<{ batchSize: number; elapsedMs: number; batches: number }>> {
  const { seedExpiredPastesForBenchmark, clearAllPastes } = await import(
    "../storage/benchmark-helper.js"
  );

  const results: Array<{ batchSize: number; elapsedMs: number; batches: number }> = [];

  for (const batchSize of batchSizes) {
    await clearAllPastes();
    await seedExpiredPastesForBenchmark(totalRows);

    const start = Date.now();
    let batches = 0;
    let remaining = countExpiredPastes();

    while (remaining > 0) {
      const expired = getExpiredPastes(batchSize);
      if (expired.length === 0) break;
      await deleteBatch(expired);
      batches += 1;
      remaining = countExpiredPastes();
    }

    results.push({ batchSize, elapsedMs: Date.now() - start, batches });
  }

  await clearAllPastes();
  return results;
}
