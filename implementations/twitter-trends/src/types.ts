export interface Tweet {
  id: string;
  userId: string;
  text: string;
  urls?: string[];
  isReply?: boolean;
  isSensitive?: boolean;
  createdAt: string;
}

export interface UrlMetadata {
  url: string;
  title: string;
  description: string;
  image: string;
  tags: string[];
  domain: string;
  fetchedAt: string;
}

export interface NewsCluster {
  clusterId: string;
  keywords: string[];
  topArticles: Array<{
    url: string;
    title: string;
    source: string;
    tweetCount: number;
  }>;
  referenceImage: string;
  domain: string;
  tweetCount: number;
  recencyScore: number;
  createdAt: string;
}

export interface EntityMention {
  entity: string;
  domain: string;
  tweetId: string;
  timestamp: number;
}

export interface TrendingEntity {
  entity: string;
  domain: string;
  score: number;
  tweetCount: number;
}

export interface Trend {
  rank: number;
  entity: string;
  domain: string;
  tweetCount: number;
  referenceImage?: string;
  topArticle?: {
    title: string;
    url: string;
    source: string;
  };
  keywords: string[];
  clusterId?: string;
}

export interface ClusterSearchResult {
  clusterId: string;
  keywords: string[];
  topArticles: NewsCluster["topArticles"];
  referenceImage: string;
  domain: string;
  score: number;
}
