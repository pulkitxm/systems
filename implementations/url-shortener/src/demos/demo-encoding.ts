import { compareApproaches, formatComparison } from "../encoding/approaches.js";
import { encodeWalkthrough } from "../encoding/base62.js";
import { decode, encode } from "../encoding/base62.js";

async function main(): Promise<void> {
  console.log("=== Demo: Three Approaches to URL Shortening ===\n");

  const url = "https://example.com/article";
  const id = 79;

  console.log(formatComparison(compareApproaches(url, id)));

  console.log("--- Worked Example: ID 79 → short code (from slides) ---\n");
  const walk = encodeWalkthrough(79);
  console.log(`ID: ${walk.id}`);
  console.log(`Binary: ${walk.binary}`);
  console.log(`Padded (multiple of 6): ${walk.paddedBinary}`);
  for (const c of walk.chunks) {
    console.log(`  ${c.bits} (${c.decimal}) → '${c.char}'`);
  }
  console.log(`Sequential map: url.sml/${walk.sequentialCode}`);
  console.log(`Shuffled map:   url.sml/${walk.shuffledCode}`);

  console.log("\n--- Round-trip decode ---");
  const code = encode(1729);
  console.log(`  encode(1729) = ${code}`);
  console.log(`  decode('${code}') = ${decode(code)}`);

  console.log("\n--- Same URL, two users (custom encoding + different IDs) ---");
  console.log("  User A shortens example.com → ID 500 →", encode(500));
  console.log("  User B shortens example.com → ID 751253 →", encode(751253));
  console.log("  Different short codes → per-user analytics possible");
}

main().catch(console.error);
