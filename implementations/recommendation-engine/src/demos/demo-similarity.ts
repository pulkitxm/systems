import { similarityWalkthrough } from "../similarity/cosine.js";
import { buildProductVectors } from "../content-filtering/feature-extractor.js";
import { getAllProducts } from "../data/product-store.js";
import { cosineSimilarity } from "../similarity/cosine.js";
import { seedDatabase } from "../data/seed-data.js";
import { closeDb } from "../data/db.js";

async function main(): Promise<void> {
  console.log(similarityWalkthrough());
  console.log("\n--- Product similarity (TF-IDF vectors) ---\n");

  seedDatabase();
  const products = getAllProducts();
  const vectors = buildProductVectors(products);

  const iphone = products.find((p) => p.title.includes("iPhone"));
  const atomic = products.find((p) => p.title.includes("Atomic"));
  const physics = products.find((p) => p.title.includes("Physics"));

  if (iphone && atomic && physics) {
    const vI = vectors.find((v) => v.productId === iphone.id)!;
    const vA = vectors.find((v) => v.productId === atomic.id)!;
    const vP = vectors.find((v) => v.productId === physics.id)!;

    console.log(`cos(iPhone, Atomic Habits) = ${cosineSimilarity(vI.vector, vA.vector).toFixed(3)}`);
    console.log(`cos(iPhone, Physics book)  = ${cosineSimilarity(vI.vector, vP.vector).toFixed(3)}`);
    console.log("\nElectronics vs books → lower similarity (different clusters expected)");
  }

  closeDb();
}

main().catch(console.error);
