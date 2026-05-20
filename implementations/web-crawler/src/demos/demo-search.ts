import { searchQuery, intersectDocIds } from "../search/query.js";
import { closeInvertedIndexDb, getInvertedIndexDb } from "../storage/inverted-index.js";

async function main(): Promise<void> {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║     Search Lookup — inverted index (no TF-IDF ranking)    ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  getInvertedIndexDb();

  for (const query of ["apple", "banana", "distributed spark"]) {
    const results = searchQuery(query);
    const intersection = intersectDocIds(results);

    console.log(`Query: "${query}"`);
    for (const r of results) {
      console.log(`  ${r.word}: ${r.docIds.length} doc(s) — ${r.docIds.slice(0, 3).join(", ")}${r.docIds.length > 3 ? "..." : ""}`);
    }
    if (results.length > 1) {
      console.log(`  AND intersection: ${intersection.length} doc(s)`);
    }
    console.log("");
  }

  console.log("Production search engines apply TF-IDF / ranking on top of these doc IDs.");

  closeInvertedIndexDb();
}

main().catch(console.error);
