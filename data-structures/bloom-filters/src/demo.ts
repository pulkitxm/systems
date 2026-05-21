/**
 * Bloom Filter Demo
 *
 * This demo shows:
 * 1. Basic usage with a small filter
 * 2. How false positives work
 * 3. The "definitely not" vs "might exist" behavior
 */

import { BloomFilter } from "./bloom-filter.js";

console.log("=".repeat(60));
console.log("BLOOM FILTER DEMO");
console.log("=".repeat(60));
console.log();

// Demo 1: Basic Usage (like the blog example)
console.log("--- Demo 1: Basic Usage (8-bit filter, 3 hash functions) ---");
console.log();

const smallFilter = new BloomFilter(8, 3);

// Add words like in the blog
const words = ["apple", "ball", "cat"];
console.log("Adding words:", words.join(", "));
for (const word of words) {
  smallFilter.add(word);
}
console.log();

// Check existence
const checkWords = ["apple", "ball", "cat", "dog", "elephant"];
console.log("Checking existence:");
for (const word of checkWords) {
  const exists = smallFilter.mightContain(word);
  const status = exists ? "MIGHT EXIST" : "DEFINITELY NOT";
  const actual = words.includes(word) ? "(actually added)" : "(never added)";
  console.log(`  ${word}: ${status} ${actual}`);
}
console.log();

// Demo 2: Optimal filter for real-world use
console.log("--- Demo 2: Optimal Filter for 10,000 items ---");
console.log();

const optimalFilter = BloomFilter.createOptimal(10000, 0.01); // 1% false positive rate

// Add 10,000 items
console.log("Adding 10,000 items (post_0 to post_9999)...");
for (let i = 0; i < 10000; i++) {
  optimalFilter.add(`post_${i}`);
}
console.log("Done!");
console.log();

// Check items that were added
console.log("Checking items that WERE added:");
let foundCount = 0;
for (let i = 0; i < 100; i++) {
  if (optimalFilter.mightContain(`post_${i}`)) {
    foundCount++;
  }
}
console.log(`  Checked 100 items, found ${foundCount}/100 (should be 100)`);
console.log();

// Check items that were NOT added
console.log("Checking items that were NOT added:");
let falsePositives = 0;
const notAddedChecks = 1000;
for (let i = 10000; i < 10000 + notAddedChecks; i++) {
  if (optimalFilter.mightContain(`post_${i}`)) {
    falsePositives++;
  }
}
console.log(`  Checked ${notAddedChecks} items, false positives: ${falsePositives}`);
console.log(`  False positive rate: ${((falsePositives / notAddedChecks) * 100).toFixed(2)}%`);
console.log(`  (Expected ~1%)`);
console.log();

// Demo 3: Instagram-like use case
console.log("--- Demo 3: Instagram Recommendation Simulation ---");
console.log();

const userWatched = BloomFilter.createOptimal(100000, 0.01);

// User watched 1000 reels
console.log("User watched 1000 reels...");
for (let i = 0; i < 1000; i++) {
  userWatched.add(`reel_${i}`);
}
console.log();

// Recommendation engine wants to show 10 new reels
console.log("Recommendation engine filtering candidates:");
const candidates = [
  "reel_50",    // watched
  "reel_999",   // watched
  "reel_1500",  // not watched
  "reel_2000",  // not watched
  "reel_100",   // watched
  "reel_5000",  // not watched
  "reel_0",     // watched (first one)
  "reel_9999",  // not watched
];

console.log();
for (const reel of candidates) {
  const mightHaveWatched = userWatched.mightContain(reel);
  const action = mightHaveWatched ? "SKIP (might have watched)" : "RECOMMEND (definitely new)";
  console.log(`  ${reel}: ${action}`);
}

console.log();
console.log("=".repeat(60));
console.log("KEY TAKEAWAY:");
console.log("- When Bloom filter says NO → 100% certain item is NOT in set");
console.log("- When Bloom filter says YES → item MIGHT be in set (could be false positive)");
console.log("=".repeat(60));
