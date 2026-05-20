import natural from "natural";

export interface DocumentVector {
  url: string;
  text: string;
  vector: number[];
  vocabulary: string[];
}

/**
 * Build TF-IDF feature vectors from article title + description + tags.
 */
export function buildTfIdfVectors(
  documents: Array<{ url: string; text: string }>
): DocumentVector[] {
  if (documents.length === 0) return [];

  const tfidf = new natural.TfIdf();
  for (const doc of documents) {
    tfidf.addDocument(tokenize(doc.text));
  }

  const vocabulary = new Set<string>();
  documents.forEach((_, i) => {
    tfidf.listTerms(i).forEach((t) => vocabulary.add(t.term));
  });
  const vocab = Array.from(vocabulary).sort();

  return documents.map((doc, i) => {
    const termScores = new Map<string, number>();
    tfidf.listTerms(i).forEach((t) => termScores.set(t.term, t.tfidf));

    const vector = vocab.map((term) => termScores.get(term) ?? 0);
    return { url: doc.url, text: doc.text, vector, vocabulary: vocab };
  });
}

function tokenize(text: string): string[] {
  const tokenizer = new natural.WordTokenizer();
  const tokens = tokenizer.tokenize(text.toLowerCase()) ?? [];
  return tokens.filter((w) => w.length > 2 && !natural.stopwords.includes(w));
}

export function vectorsToMatrix(vectors: DocumentVector[]): number[][] {
  return vectors.map((v) => v.vector);
}
