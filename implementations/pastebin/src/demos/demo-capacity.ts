import { estimateCapacity, formatCapacityReport } from "../storage/capacity.js";

async function main(): Promise<void> {
  console.log("=== Demo: Storage Capacity — DB vs S3 Decision ===\n");
  console.log(formatCapacityReport(estimateCapacity()));
  console.log("\nWhy not store 10MB files in PostgreSQL rows?");
  console.log("  Each row becomes huge → DB performance collapses.");
  console.log("Why metadata in relational DB?");
  console.log("  ~1.6 GB/month for 10M rows — trivial for one node.");
}

main().catch(console.error);
