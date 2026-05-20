import { searchWords } from "../storage/inverted-index.js";
import type { SearchResult } from "../types.js";

/**
 * Search engine lookup (relevance / TF-IDF out of scope).
 * Returns doc IDs where query terms appear in the inverted index.
 */
export function searchQuery(query: string): SearchResult[] {
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length >= 2);
  return searchWords(terms);
}

export function intersectDocIds(results: SearchResult[]): string[] {
  if (results.length === 0) return [];
  let set = new Set(results[0].docIds);
  for (let i = 1; i < results.length; i++) {
    const next = new Set(results[i].docIds);
    set = new Set([...set].filter((id) => next.has(id)));
  }
  return [...set];
}
