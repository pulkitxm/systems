import {
  estimateInvertedIndexSize,
  formatCapacityReport,
} from "../capacity/inverted-index-estimate.js";
import { CHAMPION_LIST_MAX_DOCS } from "../config.js";

async function main(): Promise<void> {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║     Inverted Index — Capacity Estimation (~320 TB)       ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  console.log(formatCapacityReport(estimateInvertedIndexSize()));

  console.log("\nOptimizations:");
  console.log(`  • Champion list: keep top ${CHAMPION_LIST_MAX_DOCS.toLocaleString()} doc IDs per word`);
  console.log("  • Compression: gzip doc-id lists for rare words (CPU on read)");
  console.log("  • Search relevance (TF-IDF) is out of scope — index lookup only");
}

main().catch(console.error);
