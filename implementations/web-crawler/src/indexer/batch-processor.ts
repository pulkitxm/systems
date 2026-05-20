import { readdir } from "fs/promises";
import { join, relative } from "path";
import { PATHS } from "../config.js";
import { readZipBatch } from "../storage/s3-blob-store.js";
import {
  indexTokens,
  isBatchProcessed,
  markBatchProcessed,
} from "../storage/inverted-index.js";
import { extractTokensFromHtml } from "./html-parser.js";

export interface ProcessorResult {
  batchesProcessed: number;
  pagesIndexed: number;
  tokenUpdates: number;
}

/**
 * Simulates a Spark job: read S3 zip batches → strip/parse/tokenize → DynamoDB.
 */
export async function runBatchIndexer(): Promise<ProcessorResult> {
  const zipFiles = await findAllZipFiles(PATHS.s3Root);
  let batchesProcessed = 0;
  let pagesIndexed = 0;
  let tokenUpdates = 0;

  for (const zipPath of zipFiles) {
    const rel = relative(PATHS.s3Root, zipPath).replace(/\\/g, "/");
    const s3Uri = `s3://the-internet/${rel}`;
    if (isBatchProcessed(s3Uri)) continue;

    const zip = readZipBatch(zipPath);
    for (const entry of zip.getEntries()) {
      if (!entry.entryName.endsWith(".html")) continue;
      const html = entry.getData().toString("utf8");
      const docId = entry.entryName.replace(/\.html$/, "");
      const tokens = extractTokensFromHtml(html);
      tokenUpdates += indexTokens(docId, tokens);
      pagesIndexed++;
    }

    markBatchProcessed(s3Uri);
    batchesProcessed++;
  }

  return { batchesProcessed, pagesIndexed, tokenUpdates };
}

async function findAllZipFiles(dir: string): Promise<string[]> {
  const out: string[] = [];

  async function walk(current: string): Promise<void> {
    let entries: string[];
    try {
      entries = await readdir(current);
    } catch {
      return;
    }
    for (const name of entries) {
      const full = join(current, name);
      const info = await import("fs/promises").then((fs) => fs.stat(full));
      if (info.isFile() && name.endsWith(".zip")) {
        out.push(full);
      } else if (info.isDirectory()) {
        await walk(full);
      }
    }
  }

  await walk(dir);
  return out.sort();
}
