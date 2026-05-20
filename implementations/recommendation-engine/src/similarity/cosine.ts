export function dotProduct(a: number[], b: number[]): number {
  let sum = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) sum += a[i] * b[i];
  return sum;
}

export function magnitude(v: number[]): number {
  return Math.sqrt(dotProduct(v, v));
}

/** cos(θ) = (A·B) / (|A||B|). 1 = identical direction, 0 = orthogonal */
export function cosineSimilarity(a: number[], b: number[]): number {
  const magA = magnitude(a);
  const magB = magnitude(b);
  if (magA === 0 || magB === 0) return 0;
  return dotProduct(a, b) / (magA * magB);
}

export function euclideanDistance(a: number[], b: number[]): number {
  let sum = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

/** Slide 4 walkthrough: smaller angle → higher cosine similarity */
export function similarityWalkthrough(): string {
  const a = [1, 0];
  const b = [0.9, 0.1];
  const c = [0, 1];

  const simAB = cosineSimilarity(a, b);
  const simAC = cosineSimilarity(a, c);

  return [
    "=== Cosine Similarity Walkthrough ===",
    "",
    "Vectors in 2D (like slide 4):",
    "  A = [1, 0]",
    "  B = [0.9, 0.1]  (small angle from A)",
    "  C = [0, 1]      (90° from A)",
    "",
    `  cos(A, B) = ${simAB.toFixed(3)}  → A and B are MORE similar`,
    `  cos(A, C) = ${simAC.toFixed(3)}  → A and C are dissimilar`,
    "",
    "Rule: θ → 0  ⇒  cos(θ) → 1  (similar)",
    "      θ → 90° ⇒  cos(θ) → 0  (dissimilar)",
    "",
    `Euclidean(A,B) = ${euclideanDistance(a, b).toFixed(3)}`,
    `Euclidean(A,C) = ${euclideanDistance(a, c).toFixed(3)}`,
  ].join("\n");
}
