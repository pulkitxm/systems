import { searchClusters as esSearch } from "../clustering/cluster-store.js";
import type { ClusterSearchResult } from "../types.js";

/**
 * News Clustering Service — given a query, returns matching clusters from Elasticsearch.
 */
export async function searchClusters(
  query: string,
  limit = 10
): Promise<ClusterSearchResult[]> {
  return esSearch(query, limit);
}

export async function getClusterForEntity(entity: string): Promise<ClusterSearchResult | null> {
  const results = await searchClusters(entity, 1);
  return results[0] ?? null;
}
