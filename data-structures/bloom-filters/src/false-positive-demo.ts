/**
 * False Positive Rate Demo
 *
 * This demo shows how false positive rate changes as you add more items
 * to a fixed-size Bloom filter.
 */

import { BloomFilter } from "./bloom-filter.js";

console.log("=".repeat(60));
console.log("FALSE POSITIVE RATE DEMO");
console.log("=".repeat(60));
console.log();

const FILTER_SIZE = 10000; // 10,000 bits
const HASH_COUNT = 7;
const TEST_ITEMS = 1000; // Items to test for false positives

console.log(`Filter size: ${FILTER_SIZE.toLocaleString()} bits`);
console.log(`Hash functions: ${HASH_COUNT}`);
console.log(`Testing with ${TEST_ITEMS} non-existent items at each step`);
console.log();

const filter = new BloomFilter(FILTER_SIZE, HASH_COUNT);

const checkpoints = [100, 500, 1000, 2000, 3000, 5000, 7000, 10000];

console.log("Items Added | Fill Ratio | False Positives | FP Rate");
console.log("-".repeat(55));

let itemsAdded = 0;

for (const checkpoint of checkpoints) {
  // Add items up to this checkpoint
  while (itemsAdded < checkpoint) {
    filter.add(`item_${itemsAdded}`);
    itemsAdded++;
  }

  // Test false positive rate
  let falsePositives = 0;
  for (let i = 0; i < TEST_ITEMS; i++) {
    // Check items that were definitely NOT added
    if (filter.mightContain(`nonexistent_${i}_${checkpoint}`)) {
      falsePositives++;
    }
  }

  const stats = filter.getStats();
  const fpRate = (falsePositives / TEST_ITEMS) * 100;

  console.log(
    `${checkpoint.toString().padStart(11)} | ` +
    `${(stats.fillRatio * 100).toFixed(1).padStart(10)}% | ` +
    `${falsePositives.toString().padStart(15)} | ` +
    `${fpRate.toFixed(2).padStart(6)}%`
  );
}

console.log();
console.log("=".repeat(60));
console.log("OBSERVATION:");
console.log("As more items are added, the fill ratio increases,");
console.log("which leads to higher false positive rates.");
console.log();
console.log("This is why you need to:");
console.log("1. Size your Bloom filter appropriately for expected items");
console.log("2. Use the optimal size formula: m = -n × ln(p) / (ln(2))²");
console.log("=".repeat(60));
