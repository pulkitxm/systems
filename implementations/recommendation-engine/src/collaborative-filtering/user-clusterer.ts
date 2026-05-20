import { kmeans } from "ml-kmeans";
import { CLUSTERING } from "../config.js";
import type { UserCluster } from "../types.js";
import { cosineSimilarity } from "../similarity/cosine.js";
import { buildUserVectors, type UserVector } from "./user-vectorizer.js";

export interface UserClusterModel {
  clusters: UserCluster[];
  vectors: UserVector[];
  userToCluster: Map<string, number>;
}

export function clusterUsers(k = CLUSTERING.USER_K): UserClusterModel {
  const vectors = buildUserVectors();
  if (vectors.length === 0) {
    return { clusters: [], vectors: [], userToCluster: new Map() };
  }

  const matrix = vectors.map((v) => v.vector);
  const numClusters = Math.min(k, vectors.length);
  const result = kmeans(matrix, numClusters, {
    initialization: "kmeans++",
    maxIterations: 100,
  });

  const userToCluster = new Map<string, number>();
  vectors.forEach((v, i) => userToCluster.set(v.userId, result.clusters[i]));

  const clusters: UserCluster[] = [];
  for (let c = 0; c < numClusters; c++) {
    const userIds = vectors
      .map((v, i) => (result.clusters[i] === c ? v.userId : null))
      .filter((id): id is string => id !== null);
    clusters.push({ clusterId: c, userIds });
  }

  return { clusters, vectors, userToCluster };
}

export function getSimilarUsersInCluster(
  userId: string,
  model: UserClusterModel,
  limit = 5
): string[] {
  const clusterId = model.userToCluster.get(userId);
  const selfVec = model.vectors.find((v) => v.userId === userId);
  if (clusterId === undefined || !selfVec) return [];

  const peers = model.vectors.filter(
    (v) => model.userToCluster.get(v.userId) === clusterId && v.userId !== userId
  );

  return peers
    .map((v) => ({
      userId: v.userId,
      sim: cosineSimilarity(selfVec.vector, v.vector),
    }))
    .sort((a, b) => b.sim - a.sim)
    .slice(0, limit)
    .map((p) => p.userId);
}
