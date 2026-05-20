import { v4 as uuidv4 } from "uuid";
import { createPaste } from "../paste-service.js";
import { closeDb } from "../storage/meta-db.js";

async function main(): Promise<void> {
  console.log("Seeding sample pastes...\n");

  const ownerId = uuidv4();
  const week = Date.now() + 7 * 86_400_000;

  const publicPaste = await createPaste({
    content: "console.log('hello gist');",
    name: "hello.js",
    ownerId,
    visibility: "PUBLIC",
    expiresAt: week,
  });
  console.log(`  PUBLIC:  ${publicPaste.url}`);

  const secretPaste = await createPaste({
    content: "temporary password: xK9#mQ2",
    name: "credentials.txt",
    ownerId,
    visibility: "SECRET",
    expiresAt: Date.now() + 86_400_000,
  });
  console.log(`  SECRET:  ${secretPaste.url}`);

  const expired = await createPaste({
    content: "this will expire",
    name: "old.txt",
    ownerId,
    visibility: "SECRET",
    expiresAt: Date.now() - 1000,
  });
  console.log(`  EXPIRED: ${expired.url} (for cleanup demo)`);

  closeDb();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
