# Bloom Filter Demo

A TypeScript implementation and demo of Bloom filters.

## What is a Bloom Filter?

A Bloom filter is a probabilistic data structure that can tell you:
- **"Definitely NOT in set"** - 100% certain
- **"Might be in set"** - could be a false positive

## Setup

```bash
pnpm install
```

## Demos

### 1. Basic Demo

Shows basic Bloom filter usage, the "definitely not" vs "might exist" behavior, and an Instagram-like recommendation simulation.

```bash
pnpm demo
```

### 2. False Positive Rate Demo

Shows how false positive rate increases as you add more items to a fixed-size filter.

```bash
pnpm false-positive
```

### 3. Redis Demo

Shows how to use Bloom filters with Redis (RedisBloom module).

```bash
# First, start Redis with RedisBloom
docker run -p 6379:6379 redis/redis-stack-server:latest

# Then run the demo
pnpm redis
```

## Key Formulas

**Optimal filter size:**
```
m = -n × ln(p) / (ln(2))²
```

**Optimal hash functions:**
```
k = (m / n) × ln(2)
```

Where:
- `m` = number of bits needed
- `n` = expected number of elements
- `p` = desired false positive probability
- `k` = number of hash functions

## Files

- `src/bloom-filter.ts` - Bloom filter implementation
- `src/demo.ts` - Basic usage demo
- `src/false-positive-demo.ts` - False positive rate demonstration
- `src/redis-demo.ts` - Redis Bloom filter demo

## Example Output

```
==========================================================
BLOOM FILTER DEMO
==========================================================

--- Demo 1: Basic Usage (8-bit filter, 3 hash functions) ---

Adding words: apple, ball, cat

Checking existence:
  apple: MIGHT EXIST (actually added)
  ball: MIGHT EXIST (actually added)
  cat: MIGHT EXIST (actually added)
  dog: DEFINITELY NOT (never added)
  elephant: MIGHT EXIST (never added)  <-- False positive!

KEY TAKEAWAY:
- When Bloom filter says NO → 100% certain item is NOT in set
- When Bloom filter says YES → item MIGHT be in set (could be false positive)
```
