import { CAPACITY_DEFAULTS } from "../config.js";
import type { CapacityEstimate } from "../types.js";

export function estimateCapacity(
  overrides?: Partial<typeof CAPACITY_DEFAULTS>
): CapacityEstimate {
  const writesPerMonth = overrides?.WRITES_PER_MONTH ?? CAPACITY_DEFAULTS.WRITES_PER_MONTH;
  const maxFileMb = overrides?.MAX_FILE_MB ?? CAPACITY_DEFAULTS.MAX_FILE_MB;
  const readRatio = overrides?.READ_RATIO ?? CAPACITY_DEFAULTS.READ_RATIO;
  const metaBytesPerRow =
    overrides?.META_BYTES_PER_ROW ?? CAPACITY_DEFAULTS.META_BYTES_PER_ROW;

  const maxFileBytes = maxFileMb * 1024 * 1024;
  const blobBytesPerMonth = writesPerMonth * maxFileBytes;
  const blobStorageTbPerMonth = blobBytesPerMonth / 1e12;
  const readBandwidthPbPerMonth = (blobBytesPerMonth * readRatio) / 1e15;
  const metaStorageGbPerMonth = (writesPerMonth * metaBytesPerRow) / 1e9;

  return {
    writesPerMonth,
    maxFileBytes,
    blobStorageTbPerMonth,
    readRatio,
    readBandwidthPbPerMonth,
    metaBytesPerRow,
    metaStorageGbPerMonth,
  };
}

export function formatCapacityReport(est: CapacityEstimate): string {
  const lines = [
    "=== Storage Capacity Estimate ===",
    "",
    `Writes/month:        ${est.writesPerMonth.toLocaleString()}`,
    `Max file size:       ${est.maxFileBytes / (1024 * 1024)} MB`,
    `Blob storage/month:  ~${est.blobStorageTbPerMonth.toFixed(0)} TB`,
    `Read ratio:          1:${est.readRatio}`,
    `Read bandwidth/month: ~${est.readBandwidthPbPerMonth.toFixed(0)} PB`,
    "",
    `Meta bytes/row:      ${est.metaBytesPerRow} (uid + name + fields)`,
    `Meta storage/month:  ~${est.metaStorageGbPerMonth.toFixed(1)} GB`,
    "",
    "Conclusion:",
    "  - File content → S3 (or blob store), NOT relational DB",
    "  - Metadata (~1.6 GB/month) → relational DB is fine",
    "  - Shard for LOAD if needed, not for metadata disk size",
  ];
  return lines.join("\n");
}
