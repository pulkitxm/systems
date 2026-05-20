export const KAFKA_TOPICS = {
  TWEETS_PUBLISHED: "tweets.published",
  TWEETS_NEWS_FILTERED: "tweets.news-filtered",
} as const;

export const KAFKA_GROUPS = {
  NEWS_FILTER: "news-filter-group",
  URL_FETCHER: "url-fetcher-group",
  ENTITY_EXTRACTOR: "entity-extractor-group",
} as const;

/** Known news domains — only tweets linking to these are clustered */
export const ALLOWED_NEWS_DOMAINS = [
  "nytimes.com",
  "bbc.com",
  "bbc.co.uk",
  "reuters.com",
  "theguardian.com",
  "espn.com",
  "cricbuzz.com",
  "timesofindia.indiatimes.com",
  "indianexpress.com",
  "cnn.com",
  "washingtonpost.com",
] as const;

/** Predefined topic hierarchy (taxonomy) — events sit below these */
export const TAXONOMY: Record<string, string[]> = {
  sports: ["cricket", "football", "tennis", "basketball"],
  politics: ["elections", "policy", "international"],
  entertainment: ["movies", "music", "celebrities"],
  technology: ["ai", "startups", "gadgets"],
  "current-affairs": ["breaking", "world", "business"],
};

/** Entity aliases for merging (e.g. "Barack" → "Barack Obama") */
export const ENTITY_ALIASES: Record<string, string> = {
  barack: "Barack Obama",
  obama: "Barack Obama",
  virat: "Virat Kohli",
  kohli: "Virat Kohli",
  bgt: "Border-Gavaskar Trophy",
  wpl: "Women's Premier League",
  ind: "India vs Australia",
  aus: "India vs Australia",
};

/** Known entities with domain mapping (simulates NER + WordNet) */
export const KNOWN_ENTITIES: Array<{ patterns: RegExp[]; entity: string; domain: string }> = [
  { patterns: [/barack\s*obama/i, /\bobama\b/i], entity: "Barack Obama", domain: "politics" },
  { patterns: [/virat\s*kohli/i, /\bkohli\b/i], entity: "Virat Kohli", domain: "sports/cricket" },
  { patterns: [/border[\s-]?gavaskar/i, /\bbgt\b/i], entity: "Border-Gavaskar Trophy", domain: "sports/cricket" },
  { patterns: [/women'?s?\s*premier\s*league/i, /\bwpl\b/i], entity: "Women's Premier League", domain: "sports/cricket" },
  { patterns: [/india\s+vs\s+australia/i, /\bind\s+vs\s+aus/i], entity: "India vs Australia", domain: "sports/cricket" },
  { patterns: [/elon\s*musk/i, /\bmusk\b/i], entity: "Elon Musk", domain: "technology" },
  { patterns: [/taylor\s*swift/i], entity: "Taylor Swift", domain: "entertainment/music" },
  { patterns: [/world\s*cup/i], entity: "World Cup", domain: "sports/cricket" },
];

export const CLUSTERING = {
  DEFAULT_K: 3,
  MIN_ARTICLES: 2,
  TOP_ARTICLES_PER_CLUSTER: 5,
  TOP_KEYWORDS: 8,
} as const;

export const TRENDING = {
  TIME_WINDOW_MS: 15 * 60 * 1000, // 15 min window for demo
  TOP_TRENDS: 10,
  JOB_INTERVAL_MS: 30 * 1000, // simulated periodic job
  RECENCY_WEIGHT: 0.6,
  VOLUME_WEIGHT: 0.4,
} as const;

export const ES_INDEX = "news-clusters";
