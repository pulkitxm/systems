import { ConsistentHash } from "./consistent-hash.js";

console.log("=".repeat(60));
console.log("VIRTUAL NODES DEMO");
console.log("=".repeat(60));
console.log();

const NUM_KEYS = 10000;
const keys: string[] = [];
for (let i = 0; i < NUM_KEYS; i++) {
  keys.push(`key_${i}`);
}

console.log(`Testing distribution of ${NUM_KEYS.toLocaleString()} keys across 3 nodes`);
console.log();

function testDistribution(virtualNodes: number): void {
  const ch = new ConsistentHash(1_000_000, virtualNodes);
  ch.addNode("node-A");
  ch.addNode("node-B");
  ch.addNode("node-C");

  const distribution = ch.getKeyDistribution(keys);

  console.log(`Virtual nodes per physical node: ${virtualNodes}`);
  console.log(`Total ring entries: ${ch.getRingSize()}`);
  console.log();

  const counts: number[] = [];
  for (const [node, nodeKeys] of distribution) {
    const percentage = ((nodeKeys.length / NUM_KEYS) * 100).toFixed(1);
    console.log(`  ${node}: ${nodeKeys.length.toString().padStart(5)} keys (${percentage.padStart(5)}%)`);
    counts.push(nodeKeys.length);
  }

  const min = Math.min(...counts);
  const max = Math.max(...counts);
  const imbalance = ((max - min) / NUM_KEYS * 100).toFixed(1);
  console.log();
  console.log(`  Imbalance (max - min): ${imbalance}%`);
  console.log(`  Ideal: ${(NUM_KEYS / 3).toFixed(0)} keys per node (33.3% each)`);
  console.log();
}

// Test with different virtual node counts
console.log("--- With 1 Virtual Node (no virtual nodes) ---");
console.log();
testDistribution(1);

console.log("--- With 10 Virtual Nodes ---");
console.log();
testDistribution(10);

console.log("--- With 50 Virtual Nodes ---");
console.log();
testDistribution(50);

console.log("--- With 100 Virtual Nodes ---");
console.log();
testDistribution(100);

console.log("--- With 500 Virtual Nodes ---");
console.log();
testDistribution(500);

console.log("=".repeat(60));
console.log("OBSERVATIONS:");
console.log("- Without virtual nodes: distribution can be very uneven");
console.log("- More virtual nodes → more even distribution");
console.log("- 100+ virtual nodes typically gives good balance");
console.log("- Trade-off: more virtual nodes = larger ring = more memory");
console.log("=".repeat(60));
