import { writeFileSync } from "fs";
import { ABUSE_WORDS_URL, getAbuseWordsFilePath } from "./abuse-words-source.js";

async function main() {
  const url = process.env.ABUSE_WORDS_URL ?? ABUSE_WORDS_URL;
  const outPath = process.env.ABUSE_WORDS_PATH ?? getAbuseWordsFilePath();

  console.log(`Fetching abuse word list from: ${url}`);
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch abuse list: ${response.status} ${response.statusText}`);
  }

  const content = await response.text();
  writeFileSync(outPath, content, "utf-8");

  const lineCount = content.split("\n").filter((line) => line.trim().length > 0).length;
  console.log(`Saved ${lineCount} non-empty lines to: ${outPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
