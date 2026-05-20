import { CAPACITY } from "../config.js";

export interface InvertedIndexEstimate {
  uniqueWords: number;
  docsPerWordAvg: number;
  keyBytesPerEntry: number;
  valueBytesPerWord: number;
  totalBytes: number;
  totalTerabytes: number;
  formula: string;
}

/**
 * Size ≈ uniqueWords × (avgWordLen + docsPerWord × docIdBytes)
 * Slide example: 1M × (8 + 10M × 32) ≈ 8 MB + 320 TB
 */
export function estimateInvertedIndexSize(): InvertedIndexEstimate {
  const {
    UNIQUE_WORDS,
    DOCS_PER_WORD_AVG,
    AVG_WORD_BYTES,
    DOC_ID_BYTES,
  } = CAPACITY;

  const keyBytesPerEntry = AVG_WORD_BYTES;
  const valueBytesPerWord = DOCS_PER_WORD_AVG * DOC_ID_BYTES;
  const totalBytes =
    UNIQUE_WORDS * (keyBytesPerEntry + valueBytesPerWord);

  const totalTerabytes = totalBytes / (1024 ** 4);

  return {
    uniqueWords: UNIQUE_WORDS,
    docsPerWordAvg: DOCS_PER_WORD_AVG,
    keyBytesPerEntry,
    valueBytesPerWord,
    totalBytes,
    totalTerabytes,
    formula: `${UNIQUE_WORDS.toLocaleString()} × (${AVG_WORD_BYTES} + ${DOCS_PER_WORD_AVG.toLocaleString()} × ${DOC_ID_BYTES})`,
  };
}

export function formatCapacityReport(est: InvertedIndexEstimate): string {
  const tb = est.totalTerabytes.toFixed(0);
  const keyMb = ((est.uniqueWords * est.keyBytesPerEntry) / (1024 ** 2)).toFixed(0);

  return [
    "Inverted index capacity estimate",
    "─────────────────────────────────",
    `  Unique words:        ${est.uniqueWords.toLocaleString()}`,
    `  Web pages:           ${CAPACITY.WEB_PAGES.toLocaleString()}`,
    `  Avg docs per word:   ${est.docsPerWordAvg.toLocaleString()} (~1% of pages)`,
    `  Doc ID size:         ${CAPACITY.DOC_ID_BYTES} bytes`,
    `  Formula:             ${est.formula}`,
    `  Key overhead:        ~${keyMb} MB (negligible vs values)`,
    `  Total (approx):      ~${tb} TB`,
    "",
    "  → One node cannot hold this; use distributed KV (e.g. DynamoDB).",
    "  → Optimizations: compression, champion lists (top docs only).",
  ].join("\n");
}
