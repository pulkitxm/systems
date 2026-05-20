export interface User {
  id: string;
  name: string;
}

export interface Product {
  id: string;
  title: string;
  description: string;
  category: string;
  price: number;
  rating: number;
  tags: string;
}

export interface Order {
  id: string;
  userId: string;
  productId: string;
  createdAt: number;
}

export interface BrowsingEvent {
  id: string;
  userId: string;
  productId: string;
  durationSec: number;
  createdAt: number;
}

export interface Recommendation {
  productId: string;
  title: string;
  score: number;
  source: "naive" | "content" | "collaborative" | "blended";
  reason?: string;
}

export interface ProductCluster {
  clusterId: number;
  productIds: string[];
  keywords: string[];
}

export interface UserCluster {
  clusterId: number;
  userIds: string[];
}

export interface ClusteredProduct {
  product: Product;
  vector: number[];
  clusterId: number;
}
