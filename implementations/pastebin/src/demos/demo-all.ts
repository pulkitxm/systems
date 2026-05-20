import { v4 as uuidv4 } from "uuid";
import { estimateCapacity, formatCapacityReport } from "../storage/capacity.js";
import { getSchemaColumns, closeDb } from "../storage/meta-db.js";
import { createPaste, getDerivedPaths, readPaste, PasteExpiredError } from "../paste-service.js";
import { cleanupExpiredPastes } from "../jobs/cleanup.js";
import { getAccessCount } from "../analytics/access-log.js";

async function main(): Promise<void> {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║     Pastebin / GitHub Gist — Full System Design Demo       ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  console.log("1. Capacity math\n");
  console.log(formatCapacityReport(estimateCapacity()) + "\n");

  console.log("2. Schema (no derivable s3_path)\n");
  console.log(`   Columns: ${getSchemaColumns().join(", ")}\n`);

  const ownerId = uuidv4();
  const paste = await createPaste({
    content: "function add(a, b) { return a + b; }",
    name: "add.js",
    ownerId,
    visibility: "PUBLIC",
    expiresAt: Date.now() + 86_400_000,
  });

  const paths = getDerivedPaths(paste.metadata);
  console.log("3. Create paste\n");
  console.log(`   URL:     ${paths.accessUrl}`);
  console.log(`   S3 path: ${paths.s3Path} (derived, not in DB)\n`);

  const { content } = await readPaste(paste.uid, { ip: "127.0.0.1" });
  console.log("4. Read paste (via API, not direct S3)\n");
  console.log(`   Content: ${content.slice(0, 50)}...`);
  console.log(`   Views:   ${getAccessCount(paste.uid)}\n`);

  const expired = await createPaste({
    content: "delete me",
    name: "temp.txt",
    ownerId,
    visibility: "SECRET",
    expiresAt: Date.now() - 1,
  });

  try {
    await readPaste(expired.uid);
  } catch (e) {
    if (e instanceof PasteExpiredError) {
      console.log("5. Expired paste → 404 on read\n");
    }
  }

  const cleanup = await cleanupExpiredPastes(100);
  console.log(`6. Cleanup job → deleted ${cleanup.deleted} expired paste(s)\n`);

  console.log("7. Caching note: skip caching 10MB files (read ratio ~1:50, infrequent access)");
  console.log("8. Production analytics: Kafka → Elasticsearch (demo uses SQLite access_events)");

  closeDb();
}

main().catch(console.error);
