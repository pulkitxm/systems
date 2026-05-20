import { join } from "path";
import { PATHS, S3_BUCKET } from "../config.js";

/**
 * S3 path is DERIVED — never stored in MetaDB.
 * Pattern: s3://{bucket}/{owner_id}/{uid}
 */
export function deriveS3Path(ownerId: string, uid: string): string {
  return `s3://${S3_BUCKET}/${ownerId}/${uid}`;
}

/** Local filesystem path simulating S3 */
export function deriveBlobFilePath(ownerId: string, uid: string): string {
  return join(PATHS.blobDir, ownerId, uid);
}

export function deriveAccessUrl(uid: string, baseUrl?: string): string {
  const base = baseUrl ?? "https://gist.example.com";
  return `${base}/${uid}`;
}
