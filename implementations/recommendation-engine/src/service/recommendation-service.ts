import { getAllProducts } from "../data/product-store.js";
import { getOrdersByUser } from "../data/order-store.js";
import { RECOMMENDATIONS } from "../config.js";
import { getPopularRecommendations } from "../naive/popular-items.js";
import { clusterProducts, type ProductClusterModel } from "../content-filtering/clusterer.js";
import { getContentRecommendations } from "../content-filtering/recommender.js";
import { clusterUsers, type UserClusterModel } from "../collaborative-filtering/user-clusterer.js";
import { getCollaborativeRecommendations } from "../collaborative-filtering/recommender.js";
import type { Recommendation } from "../types.js";

export interface RecommendationEngine {
  productModel: ProductClusterModel;
  userModel: UserClusterModel;
}

let engine: RecommendationEngine | null = null;

export function buildEngine(): RecommendationEngine {
  const products = getAllProducts();
  engine = {
    productModel: clusterProducts(products),
    userModel: clusterUsers(),
  };
  return engine;
}

export function getEngine(): RecommendationEngine {
  if (!engine) return buildEngine();
  return engine;
}

/**
 * Blended feed: exploitation (content) + exploration (collaborative).
 */
export function getBlendedRecommendations(
  userId: string,
  limit = RECOMMENDATIONS.DEFAULT_LIMIT,
  exploitationRatio = RECOMMENDATIONS.EXPLOITATION_RATIO
): Recommendation[] {
  const eng = getEngine();
  const exploitCount = Math.ceil(limit * exploitationRatio);
  const exploreCount = limit - exploitCount;

  const orders = getOrdersByUser(userId);
  const anchorProductId =
    orders[orders.length - 1]?.productId ??
    eng.productModel.vectors[0]?.productId;

  const content: Recommendation[] = anchorProductId
    ? getContentRecommendations(userId, anchorProductId, eng.productModel, exploitCount)
    : [];

  const collab = getCollaborativeRecommendations(userId, eng.userModel, exploreCount);

  const seen = new Set<string>();
  const blended: Recommendation[] = [];

  for (const r of [...content, ...collab]) {
    if (seen.has(r.productId)) continue;
    seen.add(r.productId);
    blended.push({ ...r, source: "blended" });
    if (blended.length >= limit) break;
  }

  return blended;
}

export function compareApproaches(userId: string): {
  naive: Recommendation[];
  content: Recommendation[];
  collaborative: Recommendation[];
  blended: Recommendation[];
} {
  const eng = getEngine();
  const orders = getOrdersByUser(userId);
  const anchor = orders[0]?.productId ?? eng.productModel.vectors[0]?.productId ?? "";

  return {
    naive: getPopularRecommendations(userId),
    content: anchor
      ? getContentRecommendations(userId, anchor, eng.productModel)
      : [],
    collaborative: getCollaborativeRecommendations(userId, eng.userModel),
    blended: getBlendedRecommendations(userId),
  };
}
