import { v4 as uuidv4 } from "uuid";
import { writeBlob } from "./blob-store.js";
import { closeDb, deletePaste, getDb, insertPaste } from "./meta-db.js";

export async function seedExpiredPastesForBenchmark(count: number): Promise<void> {
  const past = Date.now() - 86_400_000;
  for (let i = 0; i < count; i++) {
    const uid = uuidv4();
    const ownerId = `bench-${i % 10}`;
    await writeBlob(ownerId, uid, `expired content ${i}`);
    insertPaste(uid, {
      content: "",
      name: `bench-${i}.txt`,
      ownerId,
      visibility: "SECRET",
      expiresAt: past,
    });
  }
}

export async function clearAllPastes(): Promise<void> {
  const database = getDb();
  database.exec(`DELETE FROM access_events`);
  database.exec(`DELETE FROM store`);
}

export { closeDb };
