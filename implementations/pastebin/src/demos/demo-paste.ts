import { v4 as uuidv4 } from "uuid";
import {
  createPaste,
  editPaste,
  PasteExpiredError,
  readPaste,
} from "../paste-service.js";
import { getAccessCount } from "../analytics/access-log.js";
import { closeDb } from "../storage/meta-db.js";

async function main(): Promise<void> {
  console.log("=== Demo: Create, Read, Edit, Expiration ===\n");

  const ownerId = uuidv4();

  const paste = await createPaste({
    content: "initial content",
    name: "notes.txt",
    ownerId,
    visibility: "SECRET",
    expiresAt: Date.now() + 7 * 86_400_000,
  });
  console.log(`Created: ${paste.url}`);

  const read1 = await readPaste(paste.uid, { ip: "10.0.0.1", userAgent: "demo" });
  console.log(`Read:    ${read1.content}`);

  await editPaste(paste.uid, ownerId, "updated content v2");
  const read2 = await readPaste(paste.uid);
  console.log(`Edited:  ${read2.content}`);

  console.log(`Access count: ${getAccessCount(paste.uid)}`);

  const expired = await createPaste({
    content: "sensitive one-time password",
    name: "otp.txt",
    ownerId,
    visibility: "SECRET",
    expiresAt: Date.now() - 1,
  });

  try {
    await readPaste(expired.uid);
  } catch (e) {
    if (e instanceof PasteExpiredError) {
      console.log(`\nExpired paste returns error: ${e.message}`);
      console.log("  (API would return 404 — never serve expired content)");
    }
  }

  closeDb();
}

main().catch(console.error);
