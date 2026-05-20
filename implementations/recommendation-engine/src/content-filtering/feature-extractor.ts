import natural from "natural";
import type { Product } from "../types.js";

export interface ProductVector {
  productId: string;
  vector: number[];
  vocabulary: string[];
}

export function productToText(p: Product): string {
  return [p.title, p.description, p.category, p.tags].join(" ");
}

export function buildProductVectors(products: Product[]): ProductVector[] {
  if (products.length === 0) return [];

  const tfidf = new natural.TfIdf();
  for (const p of products) {
    tfidf.addDocument(tokenize(productToText(p)));
  }

  const vocabulary = new Set<string>();
  products.forEach((_, i) => {
    tfidf.listTerms(i).forEach((t) => vocabulary.add(t.term));
  });
  const vocab = Array.from(vocabulary).sort();

  return products.map((p, i) => {
    const termScores = new Map<string, number>();
    tfidf.listTerms(i).forEach((t) => termScores.set(t.term, t.tfidf));
    const vector = vocab.map((term) => termScores.get(term) ?? 0);
    return { productId: p.id, vector, vocabulary: vocab };
  });
}

function tokenize(text: string): string[] {
  const tokenizer = new natural.WordTokenizer();
  const tokens = tokenizer.tokenize(text.toLowerCase()) ?? [];
  return tokens.filter((w) => w.length > 2 && !natural.stopwords.includes(w));
}
