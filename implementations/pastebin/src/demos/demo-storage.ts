import { v4 as uuidv4 } from "uuid";
import { createPaste, getDerivedPaths } from "../paste-service.js";
import { getSchemaColumns, closeDb } from "../storage/meta-db.js";
import { deriveS3Path } from "../storage/path.js";

async function main(): Promise<void> {
  console.log("=== Demo: Derived S3 Path (Never Stored in DB) ===\n");

  const columns = getSchemaColumns();
  console.log("Schema columns:", columns.join(", "));
  console.log("  s3_path in schema?", columns.includes("s3_path") ? "YES (bad)" : "NO (correct)\n");

  const ownerId = "1729";
  const uid = "71293564-uuid-example";
  console.log("Derived path formula: s3://{bucket}/{owner_id}/{uid}");
  console.log(`  ${deriveS3Path(ownerId, uid)}\n`);

  const paste = await createPaste({
    content: "# Pastebin demo\nHello world.",
    name: "demo.md",
    ownerId: uuidv4(),
    visibility: "PUBLIC",
  });

  const paths = getDerivedPaths(paste.metadata);
  console.log("Created paste:");
  console.log(`  Access URL: ${paths.accessUrl}`);
  console.log(`  S3 path (derived): ${paths.s3Path}`);
  console.log(`  Blob on disk: ${paste.blobPath}`);
  console.log("\nRule: anything derivable from owner_id + uid must NOT be stored in MetaDB.");

  closeDb();
}

main().catch(console.error);
