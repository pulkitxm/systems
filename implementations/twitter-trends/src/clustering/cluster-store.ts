import { ES_INDEX } from "../config.js";
import { elasticsearch } from "../connection.js";
import type { ClusterSearchResult, NewsCluster } from "../types.js";

export async function ensureClusterIndex(): Promise<void> {
  const exists = await elasticsearch.indices.exists({ index: ES_INDEX });
  if (!exists) {
    await elasticsearch.indices.create({
      index: ES_INDEX,
      mappings: {
        properties: {
          clusterId: { type: "keyword" },
          keywords: { type: "text" },
          topArticles: { type: "object", enabled: true },
          referenceImage: { type: "keyword" },
          domain: { type: "keyword" },
          tweetCount: { type: "integer" },
          recencyScore: { type: "float" },
          createdAt: { type: "date" },
        },
      },
    });
  }
}

export async function indexClusters(clusters: NewsCluster[]): Promise<void> {
  if (clusters.length === 0) return;

  const body = clusters.flatMap((c) => [
    { index: { _index: ES_INDEX, _id: c.clusterId } },
    c,
  ]);

  await elasticsearch.bulk({ refresh: true, body });
}

export async function searchClusters(query: string, limit = 10): Promise<ClusterSearchResult[]> {
  const res = await elasticsearch.search({
    index: ES_INDEX,
    body: {
      query: {
        multi_match: {
          query,
          fields: ["keywords^2", "domain", "topArticles.title"],
          fuzziness: "AUTO",
        },
      },
      size: limit,
      sort: [{ recencyScore: "desc" }, { tweetCount: "desc" }],
    },
  });

  return (res.hits.hits as Array<{ _source: NewsCluster; _score?: number }>).map((h) => ({
    clusterId: h._source.clusterId,
    keywords: h._source.keywords,
    topArticles: h._source.topArticles,
    referenceImage: h._source.referenceImage,
    domain: h._source.domain,
    score: h._score ?? h._source.recencyScore,
  }));
}

export async function deleteAllClusters(): Promise<void> {
  const exists = await elasticsearch.indices.exists({ index: ES_INDEX });
  if (exists) {
    await elasticsearch.indices.delete({ index: ES_INDEX });
  }
}
