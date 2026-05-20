import { extractTokensFromHtml, stripHtmlToText } from "../indexer/html-parser.js";
import { runBatchIndexer } from "../indexer/batch-processor.js";
import { getInvertedIndexStats } from "../storage/inverted-index.js";
import { closeInvertedIndexDb, getInvertedIndexDb } from "../storage/inverted-index.js";

const SAMPLE = `<html><head><script>evil()</script><style>.x{}</style></head>
<body><p>Apple and banana prices rise.</p></body></html>`;

async function main(): Promise<void> {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║     Spark-style Indexer — S3 zip → tokenize → KV         ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  console.log("1. HTML → text (strip script/style/tags)\n");
  console.log(`   Input:  ${SAMPLE.slice(0, 60)}...`);
  console.log(`   Output: "${stripHtmlToText(SAMPLE)}"`);
  console.log(`   Tokens: ${extractTokensFromHtml(SAMPLE).join(", ")}\n`);

  getInvertedIndexDb();
  const result = await runBatchIndexer();

  console.log("2. Batch processor (simulates Spark on S3)\n");
  console.log(`   Batches processed: ${result.batchesProcessed}`);
  console.log(`   Pages indexed:     ${result.pagesIndexed}`);
  console.log(`   Word updates:      ${result.tokenUpdates}\n`);

  const stats = getInvertedIndexStats();
  console.log("3. Inverted index stats\n");
  console.log(`   Unique words:      ${stats.wordCount}`);
  console.log(`   Doc references:  ${stats.totalDocReferences}`);

  closeInvertedIndexDb();
}

main().catch(console.error);
