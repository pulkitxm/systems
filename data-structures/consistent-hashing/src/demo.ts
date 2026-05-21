import { ConsistentHash } from "./consistent-hash.js";

console.log("=".repeat(60));
console.log("CONSISTENT HASHING DEMO");
console.log("=".repeat(60));
console.log();

// Demo 1: Basic Usage
console.log("--- Demo 1: Basic Key Ownership ---");
console.log();

const ch = new ConsistentHash(1000, 3);

console.log("Adding 3 nodes: node-A, node-B, node-C");
ch.addNode("node-A");
ch.addNode("node-B");
ch.addNode("node-C");
console.log();

const keys = ["user_1", "user_2", "user_3", "user_4", "user_5", "order_100", "order_200", "session_xyz"];

console.log("Key ownership:");
for (const key of keys) {
  const node = ch.getNode(key);
  console.log(`  ${key} → ${node}`);
}
console.log();

// Demo 2: Consistency Check
console.log("--- Demo 2: Consistency Check ---");
console.log();

console.log("Querying same keys multiple times:");
for (let i = 0; i < 3; i++) {
  const node = ch.getNode("user_1");
  console.log(`  Query ${i + 1}: user_1 → ${node}`);
}
console.log("(Same key always maps to same node)");
console.log();

// Demo 3: Distribution
console.log("--- Demo 3: Key Distribution ---");
console.log();

const manyKeys: string[] = [];
for (let i = 0; i < 1000; i++) {
  manyKeys.push(`key_${i}`);
}

const distribution = ch.getKeyDistribution(manyKeys);
console.log("Distribution of 1000 keys across 3 nodes:");
for (const [node, nodeKeys] of distribution) {
  const percentage = ((nodeKeys.length / manyKeys.length) * 100).toFixed(1);
  console.log(`  ${node}: ${nodeKeys.length} keys (${percentage}%)`);
}
console.log();

// Demo 4: Adding a Node
console.log("--- Demo 4: Adding a New Node ---");
console.log();

console.log("Before adding node-D:");
const beforeAdd = ch.getKeyDistribution(manyKeys);
const beforeMapping = new Map<string, string>();
for (const key of manyKeys) {
  beforeMapping.set(key, ch.getNode(key)!);
}

console.log("Adding node-D...");
ch.addNode("node-D");
console.log();

console.log("After adding node-D:");
const afterAdd = ch.getKeyDistribution(manyKeys);
for (const [node, nodeKeys] of afterAdd) {
  const percentage = ((nodeKeys.length / manyKeys.length) * 100).toFixed(1);
  console.log(`  ${node}: ${nodeKeys.length} keys (${percentage}%)`);
}
console.log();

let movedKeys = 0;
for (const key of manyKeys) {
  const before = beforeMapping.get(key);
  const after = ch.getNode(key);
  if (before !== after) {
    movedKeys++;
  }
}

const movedPercentage = ((movedKeys / manyKeys.length) * 100).toFixed(1);
console.log(`Keys that changed ownership: ${movedKeys}/${manyKeys.length} (${movedPercentage}%)`);
console.log(`Expected: ~${(100 / 4).toFixed(0)}% (k/n where n=4 nodes)`);
console.log();

// Demo 5: Removing a Node
console.log("--- Demo 5: Removing a Node ---");
console.log();

console.log("Current nodes:", ch.getNodes().join(", "));

const beforeRemove = new Map<string, string>();
for (const key of manyKeys) {
  beforeRemove.set(key, ch.getNode(key)!);
}

console.log("Removing node-B...");
ch.removeNode("node-B");
console.log();

console.log("After removing node-B:");
const afterRemove = ch.getKeyDistribution(manyKeys);
for (const [node, nodeKeys] of afterRemove) {
  const percentage = ((nodeKeys.length / manyKeys.length) * 100).toFixed(1);
  console.log(`  ${node}: ${nodeKeys.length} keys (${percentage}%)`);
}
console.log();

let movedAfterRemove = 0;
for (const key of manyKeys) {
  const before = beforeRemove.get(key);
  const after = ch.getNode(key);
  if (before !== after) {
    movedAfterRemove++;
  }
}

const movedRemovePercentage = ((movedAfterRemove / manyKeys.length) * 100).toFixed(1);
console.log(`Keys that changed ownership: ${movedAfterRemove}/${manyKeys.length} (${movedRemovePercentage}%)`);
console.log(`(Only keys previously owned by node-B moved)`);
console.log();

console.log("=".repeat(60));
console.log("KEY TAKEAWAYS:");
console.log("- Same key always maps to same node (consistency)");
console.log("- Adding a node: only ~k/n keys move (minimal disruption)");
console.log("- Removing a node: only that node's keys move");
console.log("=".repeat(60));
