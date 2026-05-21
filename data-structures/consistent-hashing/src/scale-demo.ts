import { ConsistentHash, SimpleHash } from "./consistent-hash.js";

console.log("=".repeat(60));
console.log("SCALING COMPARISON: Simple Hash vs Consistent Hash");
console.log("=".repeat(60));
console.log();

const NUM_KEYS = 10000;
const keys: string[] = [];
for (let i = 0; i < NUM_KEYS; i++) {
  keys.push(`key_${i}`);
}

console.log(`Testing with ${NUM_KEYS.toLocaleString()} keys`);
console.log();

// Simple Hash (mod N)
console.log("--- Simple Hash (mod N) ---");
console.log();

const simpleHash = new SimpleHash();
simpleHash.addNode("node-0");
simpleHash.addNode("node-1");
simpleHash.addNode("node-2");

const simpleBefore = new Map<string, string>();
for (const key of keys) {
  simpleBefore.set(key, simpleHash.getNode(key)!);
}

console.log("Before (3 nodes):");
const simpleDistBefore = simpleHash.getKeyDistribution(keys);
for (const [node, nodeKeys] of simpleDistBefore) {
  console.log(`  ${node}: ${nodeKeys.length} keys`);
}
console.log();

console.log("Adding node-3...");
simpleHash.addNode("node-3");
console.log();

console.log("After (4 nodes):");
const simpleDistAfter = simpleHash.getKeyDistribution(keys);
for (const [node, nodeKeys] of simpleDistAfter) {
  console.log(`  ${node}: ${nodeKeys.length} keys`);
}
console.log();

let simpleMoved = 0;
for (const key of keys) {
  if (simpleBefore.get(key) !== simpleHash.getNode(key)) {
    simpleMoved++;
  }
}

console.log(`Keys moved: ${simpleMoved.toLocaleString()}/${NUM_KEYS.toLocaleString()} (${((simpleMoved / NUM_KEYS) * 100).toFixed(1)}%)`);
console.log();

// Consistent Hash
console.log("--- Consistent Hash ---");
console.log();

const consistentHash = new ConsistentHash(1_000_000, 100);
consistentHash.addNode("node-0");
consistentHash.addNode("node-1");
consistentHash.addNode("node-2");

const consistentBefore = new Map<string, string>();
for (const key of keys) {
  consistentBefore.set(key, consistentHash.getNode(key)!);
}

console.log("Before (3 nodes):");
const consistentDistBefore = consistentHash.getKeyDistribution(keys);
for (const [node, nodeKeys] of consistentDistBefore) {
  console.log(`  ${node}: ${nodeKeys.length} keys`);
}
console.log();

console.log("Adding node-3...");
consistentHash.addNode("node-3");
console.log();

console.log("After (4 nodes):");
const consistentDistAfter = consistentHash.getKeyDistribution(keys);
for (const [node, nodeKeys] of consistentDistAfter) {
  console.log(`  ${node}: ${nodeKeys.length} keys`);
}
console.log();

let consistentMoved = 0;
for (const key of keys) {
  if (consistentBefore.get(key) !== consistentHash.getNode(key)) {
    consistentMoved++;
  }
}

console.log(`Keys moved: ${consistentMoved.toLocaleString()}/${NUM_KEYS.toLocaleString()} (${((consistentMoved / NUM_KEYS) * 100).toFixed(1)}%)`);
console.log();

// Summary
console.log("=".repeat(60));
console.log("COMPARISON SUMMARY");
console.log("=".repeat(60));
console.log();
console.log(`                    Simple Hash    Consistent Hash`);
console.log(`Keys moved:         ${simpleMoved.toString().padStart(5)}          ${consistentMoved.toString().padStart(5)}`);
console.log(`Percentage:         ${((simpleMoved / NUM_KEYS) * 100).toFixed(1).padStart(5)}%         ${((consistentMoved / NUM_KEYS) * 100).toFixed(1).padStart(5)}%`);
console.log();
console.log("Simple Hash: When node count changes, hash(key) % N changes");
console.log("             for most keys → massive data movement");
console.log();
console.log("Consistent Hash: Only keys in the affected range move");
console.log("                 → minimal data movement (~k/n)");
console.log("=".repeat(60));
