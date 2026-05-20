import { mkdir, readFile, unlink, writeFile } from "fs/promises";
import { dirname } from "path";
import { MAX_FILE_BYTES } from "../config.js";
import { deriveBlobFilePath } from "./path.js";

export async function writeBlob(
  ownerId: string,
  uid: string,
  content: string | Buffer
): Promise<string> {
  const buf = typeof content === "string" ? Buffer.from(content, "utf8") : content;
  if (buf.length > MAX_FILE_BYTES) {
    throw new Error(`File exceeds max size of ${MAX_FILE_BYTES / (1024 * 1024)} MB`);
  }

  const filePath = deriveBlobFilePath(ownerId, uid);
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, buf);
  return filePath;
}

export async function readBlob(ownerId: string, uid: string): Promise<Buffer | null> {
  const filePath = deriveBlobFilePath(ownerId, uid);
  try {
    return await readFile(filePath);
  } catch {
    return null;
  }
}

export async function deleteBlob(ownerId: string, uid: string): Promise<void> {
  const filePath = deriveBlobFilePath(ownerId, uid);
  try {
    await unlink(filePath);
  } catch {
    // already deleted
  }
}
