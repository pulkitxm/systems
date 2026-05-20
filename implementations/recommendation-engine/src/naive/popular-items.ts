import { getProductById } from "../data/product-store.js";
import { getPopularProducts, getPurchasedProductIds } from "../data/order-store.js";
import type { Recommendation } from "../types.js";

/**
 * Naive approach: recommend most popular items to everyone.
 * Same list for all users — no personalization.
 */
export function getPopularRecommendations(
  userId: string,
  limit = 5
): Recommendation[] {
  const popular = getPopularProducts(limit + 10);
  const purchased = getPurchasedProductIds(userId);
  const results: Recommendation[] = [];

  for (const { productId, count } of popular) {
    if (results.length >= limit) break;
    const product = getProductById(productId);
    if (!product) continue;

    results.push({
      productId,
      title: product.title,
      score: count,
      source: "naive",
      reason: purchased.has(productId)
        ? "Popular (already purchased — wasteful)"
        : `Popular (${count} orders globally)`,
    });
  }

  return results;
}
