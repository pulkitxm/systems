# Web Crawler System Design

> **Motive:** Work backwards from the end goal. Scale is the problem — batch everything, partition by time, and never crawl the same URL twice within a domain cooldown.

A distributed web crawler starts from **seed URLs**, discovers links via **BFS**, downloads HTTP pages, stores raw HTML in **time-partitioned batches on S3**, and builds an **inverted index** (`word → [docId, …]`) for search engines. Relevance (TF-IDF ranking) is **out of scope** — only index construction at internet scale.

---

## TL;DR

- **Crawl:** BFS spider from seeds; extract `<a href>` links; HTTP only
- **Coordination:** URLs DB (DynamoDB-shaped) — `docId`, `url`, `lastCrawledAt`, last **5** crawl events; partition by **domain**
- **Cooldown:** Per-domain recrawl window — skip if URL crawled recently (saves bandwidth)
- **Staging:** Crawlers write HTML to **local disk** in `YYYY/MM/DD/HHMM/` folders (same layout as S3)
- **Batch upload:** Daemon runs **~5 min behind** wall clock → zip folder → **one S3 PUT** → delete local
- **Index pipeline:** Spark reads S3 zips → strip `<script>`/`<style>` → tokenize → update **inverted index** (~320 TB at scale → DynamoDB)
- **Optimizations:** Compression, **champion lists** (top docs per word only)

---

## Problem Statement

| Goal | Detail |
|------|--------|
| Input | Seed URLs |
| Traversal | Breadth-first search over discovered links |
| Storage | Raw HTML blobs; inverted index for terms |
| Scope | HTTP pages only; **no relevance ranking** |
| Scale | ~1B pages, ~1M unique words, ~320 TB inverted index |
| Tools (prod) | Scrapy-style spiders, S3, Spark/MapReduce, DynamoDB |

---

## Working Backwards

Production teams design from the **output** inward:

1. **Inverted index** — where and how big? → DynamoDB (distributed KV)
2. **Word extraction** — distributed parse/tokenize → Spark on S3 batches
3. **S3 layout** — time-partitioned zip batches (not one file per page)
4. **Crawler** — local staging + upload daemon + URLs DB coordination

This demo implements each layer with **local folders + SQLite** so you can run the full pipeline without AWS.

---

## Capacity: ~320 TB Inverted Index

| Assumption | Value |
|------------|-------|
| Web pages | 1,000,000,000 |
| Unique words | 1,000,000 |
| Doc ID size | 32 bytes |
| Avg word length | 8 bytes |
| Docs per word (avg) | 10,000,000 (~1% of pages) |

```
Size ≈ 1M × (8 + 10M × 32) ≈ 8 MB + 320 TB
```

One node cannot hold this. Use a **distributed persistent KV** (e.g. DynamoDB).

```bash
pnpm demo:capacity
```

### Optimizations

| Technique | Idea |
|-----------|------|
| **Compression** | Gzip doc-id lists; CPU cost on rare reads |
| **Champion list** | Store only top-N “significant” doc IDs per word (e.g. 1M of 10M) — ~10× smaller |

Search engines then apply **TF-IDF** (out of scope here) on top of doc IDs returned from the index.

---

## Architecture

```
                    ┌─────────────┐
                    │  Seed URLs  │
                    └──────┬──────┘
                           │ BFS
                    ┌──────▼──────┐
                    │   Spiders   │──────► URLs DB (domain partition)
                    └──────┬──────┘              docId, lastCrawledAt,
                           │                     recent 5 crawls
                           │ local HTML
                    ┌──────▼──────┐
                    │ Local disk  │  YYYY/MM/DD/HHMM/*.html
                    │  staging    │
                    └──────┬──────┘
                           │ daemon (~5 min lag)
                    ┌──────▼──────┐
                    │  S3 batches │  .../1200/batch-1.zip
                    │  (zipped)   │
                    └──────┬──────┘
                           │ Spark / MapReduce
                    ┌──────▼──────┐
                    │  Inverted   │  word → [docId, ...]
                    │    Index    │  (DynamoDB at scale)
                    └─────────────┘
                           ▲
                    ┌──────┴──────┐
                    │   Search    │  lookup only (no ranking)
                    └─────────────┘
```

---

## Deep Dive: BFS Spider

Spiders start at seeds, **download** pages, **extract links**, enqueue unvisited URLs in **FIFO order** (BFS).

```typescript
// src/crawler/spider.ts — queue + depth limit
queue.push({ url: link, depth: depth + 1 });
```

**HTTP only** — skip `mailto:`, `javascript:`, non-http(s) schemes.

This demo uses a **mock web** (`src/fixtures/seed-pages.ts`) instead of hitting the real internet.

```bash
pnpm demo:crawl
```

---

## Deep Dive: URLs DB (Coordination)

All crawlers share one logical DB with two **collections** (same DB, no extra infrastructure):

| Collection | Partition key | Stores |
|------------|---------------|--------|
| `urls` | `domain` | `docId`, `url`, `lastCrawledAt`, `recentCrawls` (max 5) |
| `domains` | `domain` | `cooldownMs`, `status`, `rank` |

Historical crawl stats beyond 5 events → archive to S3 (keeps hot rows small).

```bash
pnpm seed   # domain cooldown configs
```

---

## Deep Dive: Per-Domain Cooldown

Before fetching, the spider checks:

1. Domain config → `cooldownMs`
2. URL row → `lastCrawledAt`
3. If `now - lastCrawledAt < cooldown` → **discard** (no network call)

Example: Wikipedia-style sites crawled weekly; news sites hourly.

```typescript
// src/crawler/cooldown.ts
shouldCrawlUrl(url) → { shouldCrawl, reason, ... }
```

---

## Deep Dive: Batching to S3

**Anti-pattern:** one S3 PUT per HTML page → costly, slow, heats object store.

**Pattern:**

1. Crawler appends `.html` files under `data/crawler-staging/2026/05/21/0940/`
2. Daemon at `09:45` zips the `09:40` folder (5 min lag), uploads `batch-1.zip` to matching S3 path
3. Deletes local partition after successful upload

S3 path mirrors local layout:

```
s3://the-internet/2026/05/21/0940/batch-1.zip
```

```bash
pnpm demo:batch
```

---

## Deep Dive: Spark Indexer (Simulated)

For each zip on S3:

1. Extract HTML files
2. Remove `<script>` and `<style>`
3. Strip tags → body text
4. Tokenize (lowercase, alphanumeric)
5. Upsert `word → doc_ids` in inverted index

```bash
pnpm demo:index
pnpm demo:search
```

Production: **Spark** or **MapReduce** workers parallelize across thousands of zip files; checkpoint `processed_batches` to avoid rework.

---

## File Structure

```
web-crawler/
├── src/
│   ├── capacity/           # 320 TB estimate
│   ├── crawler/            # BFS spider, cooldown, link extractor
│   ├── batch/              # Upload daemon (zip → S3)
│   ├── indexer/            # HTML parser + batch processor
│   ├── storage/            # Local staging, S3 zips, inverted index
│   ├── urls-db/            # URLs + domains (SQLite)
│   ├── search/             # Query inverted index
│   ├── fixtures/           # Mock mini-internet
│   ├── scripts/            # init, seed
│   └── demos/              # capacity, crawl, batch, index, search, all
├── package.json
└── README.md
```

---

## Quick Start

```bash
cd implementations/web-crawler
pnpm install
pnpm init
pnpm seed
pnpm demo:all
```

Individual demos:

```bash
pnpm demo:capacity   # ~320 TB math
pnpm demo:crawl      # BFS + URLs DB
pnpm demo:batch      # zip → simulated S3
pnpm demo:index      # tokenize + inverted index
pnpm demo:search     # term lookup
```

---

## Mapping to Production

| Demo | Production |
|------|------------|
| SQLite `urls.db` | DynamoDB / Cassandra, partition `domain` |
| Local `data/s3/` | S3 `the-internet/YYYY/MM/DD/HHMM/*.zip` |
| SQLite inverted index | DynamoDB `word → doc_ids` |
| `runBatchIndexer()` | Spark cluster reading S3 |
| Mock fetcher | Scrapy / custom HTTP with politeness |
| Single process daemon | Per-host upload agent behind crawlers |

---

## Exercises

1. **Champion list:** Lower `CHAMPION_LIST_MAX_DOCS` to 100 and re-run `demo:all` — compare index size.
2. **Cooldown:** Run `demo:crawl` twice in a row — second run should show `skippedCooldown > 0`.
3. **Partition lag:** Change `BATCH_UPLOAD_LAG_MS` and observe which folders the daemon picks up.
4. **TF-IDF:** After `demo:search`, sketch how you would rank doc IDs by term frequency × inverse document frequency.
5. **Fault tolerance:** Kill the daemon mid-upload — local folder remains; re-run daemon idempotently.

---

## References

- [Scrapy](https://scrapy.org/) — popular open-source spider framework
- TF-IDF — relevance layer on top of inverted index (information retrieval)
- Arpit Bhayani — *Designing A Web Crawler* (system design series)
