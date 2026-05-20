export type DomainStatus = "REPUTED" | "NORMAL" | "LOW_PRIORITY";

export interface DomainConfig {
  domain: string;
  cooldownMs: number;
  status: DomainStatus;
  rank: number;
  displayName?: string;
}

export interface CrawlEvent {
  crawledAt: number;
  statusCode: number;
  bytesDownloaded: number;
}

export interface UrlRecord {
  docId: string;
  url: string;
  domain: string;
  lastCrawledAt: number | null;
  recentCrawls: CrawlEvent[];
}

export interface StagedPage {
  docId: string;
  url: string;
  html: string;
  crawledAt: number;
}

export interface BatchManifestEntry {
  docId: string;
  url: string;
  filename: string;
}

export interface InvertedIndexStats {
  wordCount: number;
  totalDocReferences: number;
  championTrimmedWords: number;
}

export interface SearchResult {
  word: string;
  docIds: string[];
}
