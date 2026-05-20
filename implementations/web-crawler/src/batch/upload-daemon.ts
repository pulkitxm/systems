import { readdir, stat, rm } from "fs/promises";
import { join } from "path";
import { PATHS, BATCH_UPLOAD_LAG_MS, PARTITION_WINDOW_MS } from "../config.js";
import { floorToPartition, formatTimePartition } from "../storage/paths.js";
import { uploadZipBatch } from "../storage/s3-blob-store.js";
import type { ZipBatch } from "../storage/s3-blob-store.js";

export interface DaemonResult {
  uploaded: ZipBatch[];
  deletedPartitions: string[];
}

/**
 * Runs ~5 minutes behind wall clock: zip complete time partitions,
 * upload to S3, delete local staging folder.
 */
export async function runUploadDaemon(now = Date.now()): Promise<DaemonResult> {
  const cutoff = floorToPartition(now - BATCH_UPLOAD_LAG_MS);
  const uploaded: ZipBatch[] = [];
  const deletedPartitions: string[] = [];

  const partitions = await findReadyPartitions(cutoff);

  for (const { absPath, partitionTs, rel } of partitions) {
    const batch = await uploadZipBatch(partitionTs, absPath, 1);
    uploaded.push(batch);
    await rm(absPath, { recursive: true, force: true });
    deletedPartitions.push(rel);
  }

  return { uploaded, deletedPartitions };
}

async function findReadyPartitions(cutoffTs: number): Promise<
  Array<{ absPath: string; partitionTs: number; rel: string }>
> {
  const root = PATHS.localStaging;
  const results: Array<{ absPath: string; partitionTs: number; rel: string }> = [];

  async function walk(dir: string, rel: string): Promise<void> {
    let entries: string[];
    try {
      entries = await readdir(dir);
    } catch {
      return;
    }

    const info = await stat(dir);
    if (!info.isDirectory()) return;

    const parts = rel ? rel.split("/") : [];
    if (parts.length === 4) {
      const partitionTs = parsePartitionRel(rel);
      if (partitionTs !== null && partitionTs <= cutoffTs) {
        const hasHtml = entries.some((e) => e.endsWith(".html"));
        if (hasHtml) {
          results.push({ absPath: dir, partitionTs, rel });
        }
      }
      return;
    }

    for (const name of entries) {
      await walk(join(dir, name), rel ? `${rel}/${name}` : name);
    }
  }

  await walk(root, "");
  return results.sort((a, b) => a.partitionTs - b.partitionTs);
}

function parsePartitionRel(rel: string): number | null {
  const parts = rel.split("/");
  if (parts.length !== 4) return null;
  const [y, m, d, hhmm] = parts;
  const hh = hhmm.slice(0, 2);
  const mm = hhmm.slice(2, 4);
  const ts = new Date(
    Number(y),
    Number(m) - 1,
    Number(d),
    Number(hh),
    Number(mm)
  ).getTime();
  return floorToPartition(ts);
}

export function describePartition(ts: number): string {
  return formatTimePartition(ts);
}
