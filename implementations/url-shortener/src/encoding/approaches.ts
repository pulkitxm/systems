import { createHash } from "crypto";
import { encode } from "./base62.js";
import type { ApproachComparison } from "../types.js";

const BASE = "https://url.sml";

/** Approach 1: SHA-256 hash of URL — deterministic, 16 chars */
export function hashApproach(url: string): string {
  const hash = createHash("sha256").update(url).digest("hex");
  return hash.slice(0, 16);
}

/** Approach 2: Raw auto-increment ID as short code */
export function integerApproach(id: number): string {
  return String(id);
}

/** Approach 3: Custom base-62 encoding with shuffled map */
export function customEncode(id: number): string {
  return encode(id, true);
}

export function compareApproaches(
  url: string,
  id: number,
  sameUrlTwice = true
): ApproachComparison[] {
  const hash1 = hashApproach(url);
  const hash2 = sameUrlTwice ? hashApproach(url) : hashApproach(url + "?v=2");

  return [
    {
      approach: "Hash (SHA-256)",
      shortCode: hash1,
      length: hash1.length,
      predictable: false,
      sameUrlSameCode: hash1 === hash2,
      notes: [
        "16 characters — not short",
        "Same URL always gives same hash — cannot track per-user traffic",
        "Two users shortening same URL get identical short code",
      ],
    },
    {
      approach: "Integer ID",
      shortCode: integerApproach(id),
      length: String(id).length,
      predictable: true,
      sameUrlSameCode: false,
      notes: [
        "Very short (e.g. url.sml/1729)",
        "Next code is trivially 1730, 1731 — easy to scrape entire site",
      ],
    },
    {
      approach: "Custom encoding (shuffled base-62)",
      shortCode: customEncode(id),
      length: customEncode(id).length,
      predictable: false,
      sameUrlSameCode: false,
      notes: [
        "Short human-readable string",
        "Shuffled 6-bit map — hard to guess without knowing the map",
        "Different users get different IDs → different short codes for same URL",
        "Still figureoutable if IDs are sequential — need random ID selection",
      ],
    },
  ];
}

export function formatComparison(comparisons: ApproachComparison[]): string {
  const lines: string[] = ["=== Three Approaches to URL Shortening ===\n"];
  for (const c of comparisons) {
    lines.push(`${c.approach}`);
    lines.push(`  Short code: ${BASE}/${c.shortCode} (${c.length} chars)`);
    lines.push(`  Predictable: ${c.predictable ? "YES" : "no"}`);
    lines.push(`  Same URL → same code: ${c.sameUrlSameCode ? "YES (bad)" : "no"}`);
    for (const n of c.notes) lines.push(`  - ${n}`);
    lines.push("");
  }
  return lines.join("\n");
}
