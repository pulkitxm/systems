# Consistent Hashing Demo

A TypeScript implementation and demo of consistent hashing.

## What is Consistent Hashing?

Consistent hashing is an algorithm that answers one question: **Who owns this data?**

It minimizes data movement when nodes are added or removed from a distributed system.

## Setup

```bash
pnpm install
```

## Demos

### 1. Basic Demo

Shows basic consistent hashing usage, key ownership, and what happens when nodes are added or removed.

```bash
pnpm demo
```

### 2. Scaling Comparison

Compares simple hash (mod N) vs consistent hashing when scaling.

```bash
pnpm scale
```

### 3. Virtual Nodes Demo

Shows how virtual nodes improve key distribution.

```bash
pnpm virtual-nodes
```

## How It Works

### The Ring

1. Hash space is a large constant range (e.g., 0 to 2^32-1)
2. Nodes are placed on the ring at their hash positions
3. Keys are assigned to the first node clockwise from their hash position

### Adding a Node

Only keys between the new node and its left neighbor need to move.

```
Before: [node-A at 100] ... [node-B at 500]
After:  [node-A at 100] ... [node-C at 300] ... [node-B at 500]

Only keys in range (100, 300] move from node-B to node-C
```

### Removing a Node

Only keys owned by the removed node move to its right neighbor.

```
Before: [node-A at 100] ... [node-C at 300] ... [node-B at 500]
After:  [node-A at 100] ... [node-B at 500]

Keys that were at node-C move to node-B
```

## Virtual Nodes

Without virtual nodes, distribution can be uneven. Virtual nodes solve this by placing each physical node multiple times on the ring.

```typescript
// Each physical node gets 100 positions on the ring
const ch = new ConsistentHash(1_000_000, 100);
ch.addNode("node-A"); // Creates node-A_vnode_0, node-A_vnode_1, ... node-A_vnode_99
```

## Files

- `src/consistent-hash.ts` - Consistent hashing implementation
- `src/demo.ts` - Basic usage demo
- `src/scale-demo.ts` - Comparison with simple hash
- `src/virtual-nodes-demo.ts` - Virtual nodes demonstration

## Example Output

```
============================================================
CONSISTENT HASHING DEMO
============================================================

--- Demo 1: Basic Key Ownership ---

Adding 3 nodes: node-A, node-B, node-C

Key ownership:
  user_1 → node-C
  user_2 → node-A
  user_3 → node-B
  user_4 → node-C
  user_5 → node-A

--- Demo 4: Adding a New Node ---

Adding node-D...

Keys that changed ownership: 248/1000 (24.8%)
Expected: ~25% (k/n where n=4 nodes)
```

## Key Takeaways

- Same key always maps to same node (consistency)
- Adding a node: only ~k/n keys move (minimal disruption)
- Removing a node: only that node's keys move
- Virtual nodes ensure even distribution
