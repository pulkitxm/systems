import { dirname, join } from "path";
import { fileURLToPath } from "url";

export const ABUSE_WORDS_URL =
  "https://gist.githubusercontent.com/pulkitxm/37f313430190581b04a44ed10fc16cab/raw/abuse-words.txt"; // you can use any url here...

export function getAbuseWordsFilePath(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "..", "abuse-words.txt");
}
