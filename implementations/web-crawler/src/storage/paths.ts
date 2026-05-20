import { join } from "path";
import { PATHS, S3_BUCKET, PARTITION_WINDOW_MS } from "../config.js";

/** Floor timestamp to 5-minute partition window */
export function floorToPartition(ts: number): number {
  return Math.floor(ts / PARTITION_WINDOW_MS) * PARTITION_WINDOW_MS;
}

/**
 * Time-partitioned path: s3://the-internet/2023/03/15/1200/batch-N.zip
 * Same structure on local crawler disk before upload daemon runs.
 */
export function formatTimePartition(ts: number): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(Math.floor(d.getMinutes() / 5) * 5).padStart(2, "0");
  return `${y}/${m}/${day}/${hh}${mm}`;
}

export function localPartitionDir(ts: number): string {
  return join(PATHS.localStaging, formatTimePartition(ts));
}

export function s3PartitionDir(ts: number): string {
  return join(PATHS.s3Root, formatTimePartition(ts));
}

export function s3Uri(partition: string, batchName: string): string {
  return `s3://${S3_BUCKET}/${partition}/${batchName}`;
}
