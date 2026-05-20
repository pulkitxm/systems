import { getProductById } from "../data/product-store.js";
import { getPurchasedProductIds } from "../data/order-store.js";
import { cosineSimilarity } from "../similarity/cosine.js";
import type { Recommendation } from "../types.js";
import type { ProductClusterModel } from "./clusterer.js";

/**
 * Content filtering (exploitation): recommend products similar to what user consumed.
 */
export function getContentRecommendations(
  userId: string,
  anchorProductId: string,
  model: ProductClusterModel,
  limit = 5
): Recommendation[] {
  const purchased = getPurchasedProductIds(userId);
  const clusterId = model.productToCluster.get(anchorProductId);
  const anchorVec = model.vectors.find((v) => v.productId === anchorProductId);

  if (clusterId === undefined || !anchorVec) return [];

  const candidates = model.vectors.filter(
    (v) =>
      model.productToCluster.get(v.productId) === clusterId &&
      v.productId !== anchorProductId &&
      !purchased.has(v.productId)
  );

  const scored = candidates
    .map((v) => ({
      productId: v.productId,
      score: cosineSimilarity(anchorVec.vector, v.vector),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return scored.map((s) => {
    const product = getProductById(s.productId)!;
    return {
      productId: s.productId,
      title: product.title,
      score: s.score,
      source: "content" as const,
      reason: `Similar to "${getProductById(anchorProductId)?.title}" (cluster ${clusterId})`,
    };
  });
}
