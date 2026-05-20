import { kmeans } from "ml-kmeans";
import { v4 as uuidv4 } from "uuid";
import { CLUSTERING } from "../config.js";
import type { NewsCluster, UrlMetadata } from "../types.js";
import { buildTfIdfVectors, vectorsToMatrix, type DocumentVector } from "./feature-extractor.js";

export interface ArticleInput {
  metadata: UrlMetadata;
  tweetCount: number;
}

function inferDomain(keywords: string[], tags: string[]): string {
  const combined = [...keywords, ...tags].join(" ").toLowerCase();
  if (combined.match(/cricket|bgt|wpl|kohli|test/)) return "sports/cricket";
  if (combined.match(/obama|politic|election/)) return "politics";
  if (combined.match(/musk|ai|tech/)) return "technology";
  if (combined.match(/swift|music|entertain/)) return "entertainment";
  return "current-affairs";
}

function topKeywords(docs: DocumentVector[], limit: number): string[] {
  const counts = new Map<string, number>();
  for (const d of docs) {
    d.vocabulary.forEach((term, idx) => {
      if (d.vector[idx] > 0) {
        counts.set(term, (counts.get(term) ?? 0) + d.vector[idx]);
      }
    });
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([k]) => k);
}

/**
 * K-means clustering on TF-IDF vectors. Ranks clusters by recency + size.
 */
export function clusterArticles(
  articles: ArticleInput[],
  k = CLUSTERING.DEFAULT_K
): NewsCluster[] {
  if (articles.length < CLUSTERING.MIN_ARTICLES) return [];

  const documents = articles.map((a) => ({
    url: a.metadata.url,
    text: [a.metadata.title, a.metadata.description, ...a.metadata.tags].join(" "),
  }));

  const vectors = buildTfIdfVectors(documents);
  const matrix = vectorsToMatrix(vectors);
  const numClusters = Math.min(k, articles.length);

  const result = kmeans(matrix, numClusters, { initialization: "kmeans++", maxIterations: 100 });

  const clusters: NewsCluster[] = [];
  const now = Date.now();

  for (let c = 0; c < numClusters; c++) {
    const indices = result.clusters
      .map((label, i) => (label === c ? i : -1))
      .filter((i) => i >= 0);

    if (indices.length === 0) continue;

    const clusterArticles = indices.map((i) => articles[i]);
    const clusterDocs = indices.map((i) => vectors[i]);
    const keywords = topKeywords(clusterDocs, CLUSTERING.TOP_KEYWORDS);
    const tags = clusterArticles.flatMap((a) => a.metadata.tags);

    const totalTweets = clusterArticles.reduce((s, a) => s + a.tweetCount, 0);
    const sorted = [...clusterArticles].sort((a, b) => b.tweetCount - a.tweetCount);

    const topArticles = sorted
      .slice(0, CLUSTERING.TOP_ARTICLES_PER_CLUSTER)
      .map((a) => ({
        url: a.metadata.url,
        title: a.metadata.title,
        source: a.metadata.domain,
        tweetCount: a.tweetCount,
      }));

    const newest = Math.max(
      ...clusterArticles.map((a) => new Date(a.metadata.fetchedAt).getTime())
    );
    const recencyScore = 1 / (1 + (now - newest) / 60000);
    const sizeScore = totalTweets / Math.max(articles.length, 1);

    clusters.push({
      clusterId: uuidv4(),
      keywords,
      topArticles,
      referenceImage: sorted[0].metadata.image,
      domain: inferDomain(keywords, tags),
      tweetCount: totalTweets,
      recencyScore: recencyScore * 0.6 + sizeScore * 0.4,
      createdAt: new Date().toISOString(),
    });
  }

  return clusters.sort((a, b) => b.recencyScore - a.recencyScore);
}
