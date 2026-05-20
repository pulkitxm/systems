import { getAllProducts } from "../data/product-store.js";
import { getBrowsingByUser } from "../data/browsing-store.js";
import { getOrdersByUser } from "../data/order-store.js";
import { getAllUsers } from "../data/user-store.js";

export interface UserVector {
  userId: string;
  vector: number[];
  categories: string[];
}

const CATEGORY_LIST = ["electronics", "books", "clothing"];

export function buildUserVectors(): UserVector[] {
  const users = getAllUsers();
  const products = getAllProducts();
  const productMap = new Map(products.map((p) => [p.id, p]));

  return users.map((user) => {
    const orders = getOrdersByUser(user.id);
    const browsing = getBrowsingByUser(user.id);

    const categoryCounts = new Map<string, number>();
    let totalSpend = 0;
    let count = 0;

    for (const o of orders) {
      const p = productMap.get(o.productId);
      if (!p) continue;
      categoryCounts.set(p.category, (categoryCounts.get(p.category) ?? 0) + 1);
      totalSpend += p.price;
      count++;
    }

    for (const b of browsing) {
      const p = productMap.get(b.productId);
      if (!p) continue;
      categoryCounts.set(p.category, (categoryCounts.get(p.category) ?? 0) + 0.5);
    }

    const vector = CATEGORY_LIST.map((c) => categoryCounts.get(c) ?? 0);
    const avgPrice = count > 0 ? totalSpend / count / 100000 : 0;
    vector.push(avgPrice);

    return { userId: user.id, vector, categories: CATEGORY_LIST };
  });
}

export function getUserProductIds(userId: string): Set<string> {
  const orders = getOrdersByUser(userId);
  const browsing = getBrowsingByUser(userId);
  const ids = new Set<string>();
  orders.forEach((o) => ids.add(o.productId));
  browsing.forEach((b) => ids.add(b.productId));
  return ids;
}
