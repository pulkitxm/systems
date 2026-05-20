import { mkdir } from "fs/promises";
import { PATHS } from "../config.js";
import { getDb, getSchemaColumns, closeDb } from "../storage/meta-db.js";
import { estimateCapacity, formatCapacityReport } from "../storage/capacity.js";

async function main(): Promise<void> {
  console.log("Initializing Pastebin...\n");

  await mkdir(PATHS.dataDir, { recursive: true });
  await mkdir(PATHS.blobDir, { recursive: true });

  getDb();
  const columns = getSchemaColumns();
  console.log("MetaDB table `store` columns:", columns.join(", "));
  console.log(
    columns.includes("s3_path")
      ? "  WARNING: s3_path should NOT exist (derived paths only)"
      : "  OK: no s3_path column — paths are derived from owner_id + uid"
  );

  console.log("\n" + formatCapacityReport(estimateCapacity()));
  console.log("\nBlob store:", PATHS.blobDir);
  console.log("Database:", PATHS.dbFile);

  closeDb();
  console.log("\nInit complete.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
