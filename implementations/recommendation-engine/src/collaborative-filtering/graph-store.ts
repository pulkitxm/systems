import { getAllOrders } from "../data/order-store.js";
import { getProductById } from "../data/product-store.js";
import { getSimilarUsersInCluster, type UserClusterModel } from "./user-clusterer.js";
import { getUserProductIds } from "./user-vectorizer.js";

/**
 * In-memory graph simulating Neo4j for collaborative filtering queries.
 * Edges: USER --purchased--> PRODUCT, USER --similar_to--> USER
 */
export class GraphStore {
  private purchases = new Map<string, Set<string>>();
  private similar = new Map<string, Set<string>>();

  static fromOrders(): GraphStore {
    const g = new GraphStore();
    for (const order of getAllOrders()) {
      g.addPurchase(order.userId, order.productId);
    }
    return g;
  }

  addPurchase(userId: string, productId: string): void {
    if (!this.purchases.has(userId)) this.purchases.set(userId, new Set());
    this.purchases.get(userId)!.add(productId);
  }

  addSimilarity(userA: string, userB: string): void {
    if (!this.similar.has(userA)) this.similar.set(userA, new Set());
    if (!this.similar.has(userB)) this.similar.set(userB, new Set());
    this.similar.get(userA)!.add(userB);
    this.similar.get(userB)!.add(userA);
  }

  /** Graph query: items similar users purchased but target user did not */
  findCandidatesFromSimilarUsers(
    userId: string,
    similarUserIds: string[]
  ): Map<string, number> {
    const owned = getUserProductIds(userId);
    const counts = new Map<string, number>();

    for (const peerId of similarUserIds) {
      const peerPurchases = this.purchases.get(peerId) ?? new Set();
      for (const productId of peerPurchases) {
        if (!owned.has(productId)) {
          counts.set(productId, (counts.get(productId) ?? 0) + 1);
        }
      }
    }

    return counts;
  }

  buildSimilarityEdges(model: UserClusterModel): void {
    for (const user of model.vectors) {
      const peers = getSimilarUsersInCluster(user.userId, model, 3);
      for (const peer of peers) {
        this.addSimilarity(user.userId, peer);
      }
    }
  }
}

export function graphQueryDemo(userId: string, model: UserClusterModel): string {
  const graph = GraphStore.fromOrders();
  graph.buildSimilarityEdges(model);
  const similarUsers = getSimilarUsersInCluster(userId, model, 5);
  const candidates = graph.findCandidatesFromSimilarUsers(userId, similarUsers);

  const lines = [
    `Graph query for ${userId}:`,
    `  Similar users: ${similarUsers.join(", ") || "(none)"}`,
    `  Candidates (purchased by peers, not by you):`,
  ];

  const sorted = [...candidates.entries()].sort((a, b) => b[1] - a[1]);
  for (const [pid, count] of sorted.slice(0, 5)) {
    const p = getProductById(pid);
    lines.push(`    - ${p?.title ?? pid} (${count} similar users bought)`);
  }

  return lines.join("\n");
}
