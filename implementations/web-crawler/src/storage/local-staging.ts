import { mkdir, writeFile, readdir, rm } from "fs/promises";
import { join } from "path";
import { localPartitionDir } from "./paths.js";
import type { StagedPage } from "../types.js";

export async function stagePage(page: StagedPage): Promise<string> {
  const dir = localPartitionDir(page.crawledAt);
  await mkdir(dir, { recursive: true });
  const filePath = join(dir, `${page.docId}.html`);
  const meta = join(dir, `${page.docId}.meta.json`);
  await writeFile(filePath, page.html, "utf8");
  await writeFile(
    meta,
    JSON.stringify({ docId: page.docId, url: page.url, crawledAt: page.crawledAt }),
    "utf8"
  );
  return filePath;
}

export async function listPartitionDirs(root: string): Promise<string[]> {
  const out: string[] = [];

  async function walk(dir: string, rel: string): Promise<void> {
    let entries: string[];
    try {
      entries = await readdir(dir);
    } catch {
      return;
    }
    for (const name of entries) {
      const full = join(dir, name);
      const nextRel = rel ? `${rel}/${name}` : name;
      const stat = await import("fs/promises").then((fs) => fs.stat(full));
      if (stat.isDirectory()) {
        const parts = nextRel.split("/");
        if (parts.length >= 4) {
          out.push(nextRel);
        } else {
          await walk(full, nextRel);
        }
      }
    }
  }

  await walk(root, "");
  return [...new Set(out)].sort();
}

export async function deletePartition(partitionRel: string): Promise<void> {
  const full = join(
    (await import("../config.js")).PATHS.localStaging,
    partitionRel
  );
  await rm(full, { recursive: true, force: true });
}

export async function readStagedHtml(
  partitionRel: string,
  docId: string
): Promise<string | null> {
  const { PATHS } = await import("../config.js");
  const filePath = join(PATHS.localStaging, partitionRel, `${docId}.html`);
  try {
    return await (await import("fs/promises")).readFile(filePath, "utf8");
  } catch {
    return null;
  }
}
