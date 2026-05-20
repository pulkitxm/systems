import { kmeans } from "ml-kmeans";
import { CLUSTERING } from "../config.js";
import type { Product, ProductCluster } from "../types.js";
import { buildProductVectors, type ProductVector } from "./feature-extractor.js";

export interface ProductClusterModel {
  clusters: ProductCluster[];
  vectors: ProductVector[];
  productToCluster: Map<string, number>;
}

export function clusterProducts(
  products: Product[],
  k = CLUSTERING.PRODUCT_K
): ProductClusterModel {
  const vectors = buildProductVectors(products);
  if (vectors.length === 0) {
    return { clusters: [], vectors: [], productToCluster: new Map() };
  }

  const matrix = vectors.map((v) => v.vector);
  const numClusters = Math.min(k, products.length);
  const result = kmeans(matrix, numClusters, {
    initialization: "kmeans++",
    maxIterations: 100,
  });

  const productToCluster = new Map<string, number>();
  vectors.forEach((v, i) => productToCluster.set(v.productId, result.clusters[i]));

  const clusters: ProductCluster[] = [];
  for (let c = 0; c < numClusters; c++) {
    const productIds = vectors
      .map((v, i) => (result.clusters[i] === c ? v.productId : null))
      .filter((id): id is string => id !== null);

    const keywords = topTerms(vectors.filter((_, i) => result.clusters[i] === c));
    clusters.push({ clusterId: c, productIds, keywords });
  }

  return { clusters, vectors, productToCluster };
}

function topTerms(clusterVectors: ProductVector[], limit = 5): string[] {
  const counts = new Map<string, number>();
  for (const v of clusterVectors) {
    v.vocabulary.forEach((term, idx) => {
      if (v.vector[idx] > 0) {
        counts.set(term, (counts.get(term) ?? 0) + v.vector[idx]);
      }
    });
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([k]) => k);
}
