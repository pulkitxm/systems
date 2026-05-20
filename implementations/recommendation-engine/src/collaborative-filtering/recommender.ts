import { getProductById } from "../data/product-store.js";
import { RECOMMENDATIONS } from "../config.js";
import type { Recommendation } from "../types.js";
import { GraphStore } from "./graph-store.js";
import { getSimilarUsersInCluster, type UserClusterModel } from "./user-clusterer.js";

/**
 * Collaborative filtering (exploration): recommend what similar users bought.
 */
export function getCollaborativeRecommendations(
  userId: string,
  model: UserClusterModel,
  limit = RECOMMENDATIONS.DEFAULT_LIMIT
): Recommendation[] {
  const graph = GraphStore.fromOrders();
  graph.buildSimilarityEdges(model);

  const similarUsers = getSimilarUsersInCluster(
    userId,
    model,
    RECOMMENDATIONS.SIMILAR_USERS_SAMPLE
  );

  const candidates = graph.findCandidatesFromSimilarUsers(userId, similarUsers);
  const sorted = [...candidates.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);

  return sorted.map(([productId, count]) => {
    const product = getProductById(productId)!;
    return {
      productId,
      title: product.title,
      score: count,
      source: "collaborative",
      reason: `${count} similar user(s) in your cohort purchased this`,
    };
  });
}
