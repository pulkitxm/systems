import { mkdir, readdir, readFile, writeFile, rm } from "fs/promises";
import { join } from "path";
import AdmZip from "adm-zip";
import { PATHS } from "../config.js";
import { s3PartitionDir, s3Uri, formatTimePartition } from "./paths.js";
import type { BatchManifestEntry } from "../types.js";

export interface ZipBatch {
  partition: string;
  zipPath: string;
  s3Uri: string;
  manifest: BatchManifestEntry[];
}

export async function uploadZipBatch(
  partitionTs: number,
  sourceDir: string,
  batchIndex: number
): Promise<ZipBatch> {
  const partition = formatTimePartition(partitionTs);
  const destDir = s3PartitionDir(partitionTs);
  await mkdir(destDir, { recursive: true });

  const batchName = `batch-${batchIndex}.zip`;
  const zipPath = join(destDir, batchName);

  const zip = new AdmZip();
  const entries = await readdir(sourceDir);
  const manifest: BatchManifestEntry[] = [];

  for (const name of entries) {
    if (!name.endsWith(".html")) continue;
    const docId = name.replace(/\.html$/, "");
    const html = await readFile(join(sourceDir, name), "utf8");
    let url = `unknown://${docId}`;
    const metaName = `${docId}.meta.json`;
    if (entries.includes(metaName)) {
      const meta = JSON.parse(
        await readFile(join(sourceDir, metaName), "utf8")
      ) as { url?: string };
      if (meta.url) url = meta.url;
    }
    zip.addFile(name, Buffer.from(html, "utf8"));
    manifest.push({ docId, url, filename: name });
  }

  zip.writeZip(zipPath);

  return {
    partition,
    zipPath,
    s3Uri: s3Uri(partition, batchName),
    manifest,
  };
}

export async function listS3ZipBatches(): Promise<ZipBatch[]> {
  const batches: ZipBatch[] = [];

  async function scan(dir: string, partition: string): Promise<void> {
    let entries: string[];
    try {
      entries = await readdir(dir);
    } catch {
      return;
    }
    for (const name of entries) {
      const full = join(dir, name);
      if (name.endsWith(".zip")) {
        const zip = new AdmZip(full);
        const manifest: BatchManifestEntry[] = zip
          .getEntries()
          .filter((e) => e.entryName.endsWith(".html"))
          .map((e) => ({
            docId: e.entryName.replace(/\.html$/, ""),
            url: e.entryName,
            filename: e.entryName,
          }));
        batches.push({
          partition,
          zipPath: full,
          s3Uri: s3Uri(partition, name),
          manifest,
        });
      } else {
        const stat = await import("fs/promises").then((fs) => fs.stat(full));
        if (stat.isDirectory()) {
          const nextPartition = partition ? `${partition}/${name}` : name;
          if (nextPartition.split("/").length >= 4) {
            for (const z of entries.filter((x) => x.endsWith(".zip"))) {
              /* handled above */
            }
          } else {
            await scan(full, nextPartition);
          }
        }
      }
    }
  }

  await scan(PATHS.s3Root, "");
  return batches.sort((a, b) => a.s3Uri.localeCompare(b.s3Uri));
}

export function readZipBatch(zipPath: string): AdmZip {
  return new AdmZip(zipPath);
}

export async function clearS3Data(): Promise<void> {
  await rm(PATHS.s3Root, { recursive: true, force: true });
}
