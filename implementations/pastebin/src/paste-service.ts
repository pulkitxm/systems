import { v4 as uuidv4 } from "uuid";
import { logAccess } from "./analytics/access-log.js";
import { BASE_URL } from "./config.js";
import { deleteBlob, readBlob, writeBlob } from "./storage/blob-store.js";
import {
  deletePaste,
  getPasteByUid,
  insertPaste,
  updatePasteContent,
} from "./storage/meta-db.js";
import { deriveAccessUrl, deriveS3Path } from "./storage/path.js";
import type { CreatePasteInput, PasteMetadata, PasteResult } from "./types.js";

export class PasteNotFoundError extends Error {
  constructor(uid: string) {
    super(`Paste not found: ${uid}`);
    this.name = "PasteNotFoundError";
  }
}

export class PasteExpiredError extends Error {
  constructor(uid: string) {
    super(`Paste expired: ${uid}`);
    this.name = "PasteExpiredError";
  }
}

function isExpired(meta: PasteMetadata, now = Date.now()): boolean {
  return meta.expiresAt !== null && meta.expiresAt < now;
}

/**
 * Create: generate UUID → upload blob (derived path) → insert MetaDB
 * S3 path is NOT stored — only owner_id + uid in MetaDB
 */
export async function createPaste(input: CreatePasteInput): Promise<PasteResult> {
  const uid = uuidv4();
  const blobPath = await writeBlob(input.ownerId, uid, input.content);
  const metadata = insertPaste(uid, input);

  return {
    uid,
    url: deriveAccessUrl(uid, BASE_URL),
    blobPath,
    metadata,
  };
}

/**
 * Read: MetaDB lookup → check expiration → derive S3 path → read blob
 */
export async function readPaste(
  uid: string,
  access?: { ip?: string; userAgent?: string }
): Promise<{ metadata: PasteMetadata; content: string }> {
  const metadata = getPasteByUid(uid);
  if (!metadata) throw new PasteNotFoundError(uid);

  if (isExpired(metadata)) throw new PasteExpiredError(uid);

  const blob = await readBlob(metadata.ownerId, uid);
  if (!blob) throw new PasteNotFoundError(uid);

  logAccess({ uid, ip: access?.ip, userAgent: access?.userAgent });

  return { metadata, content: blob.toString("utf8") };
}

export async function editPaste(
  uid: string,
  ownerId: string,
  content: string,
  name?: string
): Promise<void> {
  const metadata = getPasteByUid(uid);
  if (!metadata) throw new PasteNotFoundError(uid);
  if (metadata.ownerId !== ownerId) {
    throw new Error("Only the owner can edit this paste");
  }
  if (isExpired(metadata)) throw new PasteExpiredError(uid);

  await writeBlob(metadata.ownerId, uid, content);
  updatePasteContent(uid, name);
}

export function getDerivedPaths(metadata: PasteMetadata): {
  s3Path: string;
  accessUrl: string;
} {
  return {
    s3Path: deriveS3Path(metadata.ownerId, metadata.uid),
    accessUrl: deriveAccessUrl(metadata.uid, BASE_URL),
  };
}

export async function deletePasteFully(uid: string): Promise<void> {
  const metadata = getPasteByUid(uid);
  if (!metadata) return;
  await deleteBlob(metadata.ownerId, uid);
  deletePaste(uid);
}
