# URL Shortener System Design

> **Motive:** Understand partitioning, sharding, and an out-of-the-box solution for generating pseudo-random, human-readable short URLs at scale.

Design a URL shortener (like `url.sml`) that produces **pseudo-random** short codes — hard to guess, not derived from the original URL — and redirects visitors to the long URL. Scale: **~100 million URLs per month**. Custom aliases are **out of scope**.

---

## TL;DR

- **Hashing URLs fails** — 16 chars (SHA-256), deterministic (same URL → same code, no per-user analytics)
- **Raw integer IDs fail** — short but predictable (`/1729` → `/1730` → scrape everything)
- **Custom base-62 encoding wins** — 62 chars = 6 bits each; **shuffled** char map hides the scheme
- **Sequential IDs still leak patterns** — fix with **ticket server**: range-partitioned, random range pick, atomic increment
- **Storage is KV** — `short_code → url`; shard by `short_code` for **load**, not disk (~12.8 GB/month is tiny)

---

## Problem Statement

| Requirement | Detail |
|-------------|--------|
| Short URL | Pseudo-random, human-readable (a–z, A–Z, 0–9) |
| Redirect | Visiting short URL → original URL |
| Scale | ~100M URLs/month |
| Out of scope | Custom aliases |

**Why pseudo-random?** So attackers cannot scrape all short URLs by incrementing a counter or reversing the encoding map.

---

## Three Approaches

### Approach 1: Hash the URL (SHA-256)

```
url.sml/abcdefghijklmnop   ← 16 characters (256 bits → 16 bytes hex)
```

| Issue | Why it fails |
|-------|----------------|
| Length | 16 chars is not “short” |
| Deterministic | Same URL → same hash for every user |
| Analytics | Cannot tell user A vs user B traffic on the same link |

### Approach 2: Integer ID as short code

```
DB assigns ID 1729  →  url.sml/1729
```

| Issue | Why it fails |
|-------|----------------|
| Predictable | Next URL is 1730, 1731 — trivial to scrape |

### Approach 3: Custom encoding (chosen)

Encode the integer ID into a string using a **secret shuffled 6-bit character map**. Different users get different IDs → different short codes even for the same long URL.

---

## Deep Dive: Custom Encoding (6-bit Base-62)

**Alphabet:** `a-z` (26) + `A-Z` (26) + `0-9` (10) = **62 characters** ≈ 2⁶ → **6 bits per character**.

**Sequential map (predictable):**

```
000000 → a,  000001 → b,  000010 → c,  000011 → d, ...
```

**Shuffled map (server secret):**

```
000000 → q,  000001 → d,  000010 → e,  000011 → A, ...
```

### Worked example: ID 79 (from slides)

```
ID:     79
Binary: 1001111  (7 bits)
Pad:    000001 001111  (left-pad to multiple of 6)

Chunk 1: 000001 → b  (sequential map)
Chunk 2: 001111 → p

Short code (sequential):  bp  →  url.sml/bp
Short code (shuffled):    different — only server knows the map
```

```typescript
// src/encoding/base62.ts
export function encode(id: number, useShuffled = true): string {
  let binary = id.toString(2);
  const pad = (6 - (binary.length % 6)) % 6;
  binary = "0".repeat(pad) + binary;
  // map each 6-bit chunk through SHUFFLED_MAP
}
```

**Remaining problem:** If IDs are still 1, 2, 3, …, back-to-back requests can reverse-engineer the map (BP → BQ → BR). **Root cause is sequential IDs, not the encoding.**

---

## Deep Dive: Ticket Server (Random ID Ranges)

Partition ID space into ranges (e.g. 0–250K, 250K–500K, …). A **ticket server** (MySQL in production; Redis here) issues the next integer from a range **atomically**.

```
User → API Server → pick random range ID → ticket server
                    SELECT current FROM range WHERE id = ?
                    UPDATE current = current + 1  (one transaction)
                    → return 500, then 751253, then 252, ...  (non-sequential)
```

| Property | How |
|----------|-----|
| Unique | Atomic increment per range |
| Pseudo-random | Random range selection each request |
| No collisions | Ranges do not overlap |

```typescript
// src/id-generation/ticket-server.ts — Lua script for atomic issue
redis.call('HSET', key, 'current', current + 1)
return current
```

Then: `shortCode = encode(id)` with shuffled map.

---

## Deep Dive: Storage & Sharding

**Schema (conceptual):**

| short_code | url | metadata |
|------------|-----|----------|
| bpqAz9 | https://... | userId, createdAt |
| a2Am6 | https://... | ... |

**Important:** `short_code` is **not** derived from the URL. It comes from the encoded ticket-server ID.

**Access pattern:** pure KV — `GET short_code → url`. Any KV store or RDBMS works; partition by `short_code`.

**Capacity math (slides):**

```
100M URLs/month × (8 bytes code + 120 bytes URL) = 12.8 GB/month
```

Storage is **not** the bottleneck. **Query load** is — shard across nodes to spread reads/writes.

```typescript
// src/storage/url-store.ts
export function getShardForShortCode(shortCode: string): number {
  return hash(shortCode) % SHARD_COUNT;
}
```

---

## Architecture

```
┌──────────┐     ┌─────────────┐     ┌──────────────────┐
│  Client  │────▶│ API Server  │────▶│  Ticket Server   │
└──────────┘     │             │     │  (range tables)  │
                 │  encode(id) │     └────────┬─────────┘
                 │      │      │              │ unique int
                 │      ▼      │              │
                 │  short_code │◀─────────────┘
                 │      │      │
                 │      ▼      │
                 │  URLs DB    │  KV: short_code → url
                 │  (sharded)  │  partitioned by short_code
                 └─────────────┘
```

---

## File Structure

```
url-shortener/
├── README.md
├── docker-compose.yml
└── src/
    ├── encoding/
    │   ├── approaches.ts    # Hash vs integer vs custom
    │   ├── char-map.ts      # Shuffled 6-bit map
    │   └── base62.ts        # encode / decode / walkthrough
    ├── id-generation/
    │   ├── range-store.ts   # Range partitions in Redis
    │   └── ticket-server.ts # Atomic pseudo-random ID issue
    ├── storage/
    │   └── url-store.ts     # KV + shard helper
    ├── shortener.ts         # shortenUrl / resolveShortUrl
    ├── scripts/             # init, seed
    └── demos/               # encoding, id-gen, storage, all
```

---

## Design Decisions Summary

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Short code source | Encoded ticket ID | Not hash of URL; per-user uniqueness |
| Character set | 62 alphanumeric | 6 bits/char, URL-safe |
| Map | Shuffled (secret) | Harder to guess than a→b→c |
| ID issuance | Range + random pick | Pseudo-random without collision-prone `Math.random()` |
| Store | KV by short_code | O(1) redirect lookup |
| Sharding | By short_code hash | Load, not 12.8 GB/month volume |

---

## Setup

```bash
cd implementations/url-shortener
docker compose up -d
pnpm install
pnpm init
pnpm seed
pnpm demo:all
```

**Ports:** Redis `6381` (avoids conflict with other implementations on 6379/6380).

---

## Demos

| Script | What it shows |
|--------|----------------|
| `pnpm demo:encoding` | All 3 approaches + ID 79 walkthrough |
| `pnpm demo:id-gen` | Ticket server non-sequential IDs |
| `pnpm demo:storage` | Shorten, resolve, sharding, same URL two users |
| `pnpm demo:all` | End-to-end |

---

## Key Takeaways

1. **Hashing** — wrong tool (length + determinism)
2. **Raw IDs** — right uniqueness, wrong predictability
3. **Encoding** — compresses ID to short string; **shuffle** the map
4. **Ticket server** — uniqueness + pseudo-randomness via range partitioning
5. **Shard for load** — 12.8 GB/month fits one machine; QPS does not

---

## Exercises

1. Draw the full flow: shorten request → ticket → encode → store → redirect lookup
2. Implement **sequential** vs **shuffled** map side-by-side and scrape-test with 50 sequential IDs
3. Add a second ticket server instance and split ranges across machines
4. Compute: how many 6-bit chars needed for 1 billion IDs?
5. Extend with **301 redirect** HTTP API (Express) on top of `resolveShortUrl`

---

## Related

- [Designing URL Shorteners](https://arpitbhayani.me) — Arpit Bhayani system design series
