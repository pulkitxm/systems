# Twitter Trends System Design

> **Motive:** A deceptively simple "What's happening" screen hides a large distributed pipeline — ingestion, filtering, clustering, entity detection, scoring, enrichment, and a read-optimized serving path.

This implementation models the **Twitter Trends page** (not hashtag-only trending). When you click a trend, you see a representative image, a top article from a trusted source, and a ranked list of topics/entities — hashtags, events, and named entities like "Barack Obama" or "Border-Gavaskar Trophy."

---

## TL;DR

- **Input:** ~350K tweets/min via **Kafka** (`tweets.published`) after API server writes to sharded Tweets DB
- **News path:** Filter tweets with URLs from allowlisted domains → enrich via URL fetcher → **TF-IDF + K-means** clustering → **Elasticsearch**
- **Trending path:** Quality filter → **NER + taxonomy** entity tagging → time-windowed aggregation → scorer/ranker with entity merge
- **Serving:** Periodic trends job enriches top entities via News Clustering Service → precomputed **Trends DB** (Redis) → fast read API
- **Read path optimized; write path heavy** — classic pattern for user-facing features at scale

---

## Problem Statement

Design the system behind Twitter's Trends page:

1. Show a **hero image** and **top article** for the leading trend
2. List additional trends (hashtags, topics, **entities** — not only `#hashtags`)
3. Provide **context** (why something is trending) via clustered news articles
4. Operate on **full tweet firehose** in near real-time with durability and anti-gaming

**What makes this hard:**

| Challenge | Why it matters |
|-----------|----------------|
| Volume | ~350K tweets/min — synchronous processing would overwhelm a single service |
| Rich context | Trends need articles/images, not just hashtag counts |
| Entity consolidation | `#Obama`, `Barack`, `Barack Obama` → one entity |
| Recency bias | Recent events outweigh stale high-volume topics |
| Gaming | Spam, replies, duplicate posts must be filtered |

---

## Architecture

```
┌──────────────┐     ┌─────────────┐     ┌──────────────────────┐
│  User tweets │────▶│  API Server │────▶│  Tweets DB (Redis)   │
└──────────────┘     │             │     │  sharded by user_id  │
                     │             │     └──────────────────────┘
                     │             │
                     │             └──────▶ Kafka: tweets.published
                     └─────────────┘
                                    │
          ┌─────────────────────────┼─────────────────────────┐
          │                         │                         │
          ▼                         ▼                         ▼
┌─────────────────┐    ┌─────────────────────┐    ┌─────────────────────┐
│  News Filter    │    │  Entity Extractor   │    │  (other consumers)  │
│  known domains  │    │  quality filter     │    │                     │
└────────┬────────┘    └──────────┬──────────┘    └─────────────────────┘
         │                        │
         ▼                        ▼
┌─────────────────┐    ┌─────────────────────┐
│ Kafka: news     │    │  Aggregator (Redis   │
│ filtered        │    │  time windows)       │
└────────┬────────┘    └──────────┬──────────┘
         │                        ▼
         ▼               ┌─────────────────────┐
┌─────────────────┐    │  Scorer / Ranker    │
│  URL Fetcher    │    │  merge entities     │
│  → KV store     │    └──────────┬──────────┘
└────────┬────────┘               │
         │                        ▼
         ▼               ┌─────────────────────┐
┌─────────────────┐    │  Candidate Entities │
│ TF-IDF + K-Means│    │  DB (Redis ZSET)    │
└────────┬────────┘    └──────────┬──────────┘
         │                        │
         ▼                        ▼
┌─────────────────┐    ┌─────────────────────┐
│ Elasticsearch   │◀───│  Trends Job (5min)  │
│ cluster metadata│    │  enrich + store     │
└────────┬────────┘    └──────────┬──────────┘
         │                        │
         ▼                        ▼
┌─────────────────┐    ┌─────────────────────┐
│ News Clustering │    │  Trends DB (Redis)  │
│ Service         │    └──────────┬──────────┘
└─────────────────┘               │
                                  ▼
                         ┌─────────────────┐
                         │  Trends API     │
                         │  (read path)    │
                         └─────────────────┘
```

---

## Deep Dive: Tweet Ingestion

When a user tweets, the API server:

1. Persists to **Tweets DB** — sharded by `user_id` so timeline reads never cross shards
2. Publishes event to **Kafka** `tweets.published` (partition key = `user_id`)

```typescript
// src/ingestion/producer.ts — partition key keeps user's tweets ordered per partition
await producer.send({
  topic: KAFKA_TOPICS.TWEETS_PUBLISHED,
  messages: [{ key: tweet.userId, value: JSON.stringify(tweet) }],
});
```

**Why Kafka?** Durability + ~350K writes/min is trivial for Kafka. Decouples write path from analytics consumers.

---

## Deep Dive: News Filtering & URL Enrichment

Trends need **context** (articles, images). We only cluster tweets linking to **allowlisted news domains** (`nytimes.com`, `bbc.com`, `cricbuzz.com`, etc.).

```
tweets.published → News Filter → tweets.news-filtered → URL Fetcher → Redis KV
```

Per URL we store:

- `url:{hash}:meta` — title, description, image, tags
- `url:{hash}:tweets` — tweet IDs referencing this URL

This KV layer feeds the clustering pipeline.

---

## Deep Dive: News Clustering (TF-IDF + K-Means)

**Predefined taxonomy** (Sports → Cricket) exists for broad topics. **Events** (BGT, WPL) are discovered by clustering.

1. Build **TF-IDF vectors** from article title + description + tags (`natural` library)
2. Run **K-means** (`ml-kmeans`) to group similar articles
3. Per cluster extract: top N articles, reference image, keywords
4. Rank clusters by **recency (60%) + size (40%)**
5. Index in **Elasticsearch** for natural-language queries

```typescript
// Query: "cricket" → Border-Gavaskar Trophy, WPL, India vs Australia clusters
const clusters = await searchClusters("cricket");
```

**Why Elasticsearch?** Trends/search/discover need fuzzy, multi-field queries — not rigid SQL.

---

## Deep Dive: Trending Entities (Not Just Hashtags)

A separate consumer on `tweets.published`:

1. **Quality filter** — drop replies, sensitive content, same-user spam (>5 tweets/window)
2. **Entity extraction** — NER patterns + taxonomy mapping (simulates NER + WordNet)
3. **Aggregate** — Redis sorted sets per time window: `entity:counts:{window}`
4. **Score & merge** — canonicalize aliases (`Barack` → `Barack Obama`), rank by volume + recency weight

---

## Deep Dive: Trends Job & Serving

**Write path (heavy):** Periodic job (every 5–10 min in production):

1. Read top candidates from `candidates:ranked`
2. Call **News Clustering Service** → Elasticsearch for reference image + top article
3. Write precomputed trends to `trends:current`

**Read path (light):** `getTrending()` reads Redis — no computation on user request.

```typescript
// src/services/trends-service.ts
export async function getTrending(): Promise<Trend[]> {
  const raw = await redis.get(KEYS.trendsCurrent);
  return JSON.parse(raw) as Trend[];
}
```

---

## File Structure

```
twitter-trends/
├── README.md
├── package.json
├── docker-compose.yml
└── src/
    ├── connection.ts          # Kafka, Redis, Elasticsearch clients
    ├── config.ts              # Domains, taxonomy, entity maps
    ├── types.ts
    ├── pipeline.ts            # End-to-end orchestration + sample data
    ├── ingestion/
    │   ├── producer.ts
    │   └── tweet-store.ts
    ├── filtering/
    │   ├── news-filter.ts
    │   └── url-fetcher.ts
    ├── clustering/
    │   ├── feature-extractor.ts
    │   ├── clusterer.ts
    │   └── cluster-store.ts
    ├── trending/
    │   ├── entity-extractor.ts
    │   ├── aggregator.ts
    │   ├── scorer.ts
    │   └── trends-job.ts
    ├── services/
    │   ├── clustering-service.ts
    │   └── trends-service.ts
    ├── scripts/
    │   ├── init.ts
    │   └── seed.ts
    └── demos/
        ├── demo-ingestion.ts
        ├── demo-clustering.ts
        ├── demo-trending.ts
        └── demo-all.ts
```

---

## Design Decisions Summary

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Tweet transport | Kafka | Durability, high throughput, multiple consumers |
| Tweets DB sharding | `user_id` | Timeline reads stay single-shard |
| News-only clustering | Domain allowlist | Rich metadata; avoid clustering noise |
| Cluster storage | Elasticsearch | NL queries for search/trends/discover |
| Entity trending | NER + aggregation | Entities > raw hashtags |
| Trends serving | Precomputed Redis | Sub-ms reads; batch writes |
| Two Kafka topics | Logical separation | Same cluster, different topics |

---

## Performance Characteristics

| Stage | Throughput model | Bottleneck |
|-------|------------------|------------|
| Kafka ingest | Horizontal (partitions) | Broker disk |
| URL fetch | Worker pool | External site rate limits |
| Clustering | Batch job | CPU for TF-IDF/K-means |
| Entity agg | O(1) per tweet (Redis ZINCRBY) | Memory per window |
| Trends read | O(1) Redis GET | None (precomputed) |

---

## Setup

**Prerequisites:** Docker, pnpm

```bash
cd implementations/twitter-trends
docker compose up -d
pnpm install
pnpm init    # Kafka topics + ES index + Redis ping
pnpm seed    # Run full pipeline with sample tweets
```

**Ports:**

| Service | Port |
|---------|------|
| Kafka | 9092 |
| Kafka UI | 8080 |
| Elasticsearch | 9200 |
| Redis | 6380 (mapped from 6379) |

**Optional:** Skip Kafka for in-process demos if broker is down:

```bash
SKIP_KAFKA=1 pnpm demo:all
```

---

## Demos

```bash
pnpm demo:ingestion   # Tweets → news filter → URL enrichment
pnpm demo:clustering  # TF-IDF + K-means → Elasticsearch query
pnpm demo:trending    # Entities → score → trends page output
pnpm demo:all         # Full end-to-end pipeline
```

Example output (trends page):

```
=== Twitter Trends Page ===

[Hero Image] https://example.com/bgt.jpg
Top Trend: Virat Kohli
  Article: Border-Gavaskar Trophy: India take lead in Sydney (cricbuzz.com)

1. Virat Kohli — 3 posts
   Domain: sports/cricket
   Top article: Border-Gavaskar Trophy: India take lead in Sydney
   Keywords: cricket, india, kohli, bgt, sydney
...
```

---

## Key Takeaways

1. **Simple UI, complex backend** — one screen touches Kafka, KV store, ML clustering, ES, and batch jobs
2. **Break problems apart** — ingestion → clustering → trending → serving, then wire together
3. **Read/write split** — precompute trends; never score on the hot path
4. **Entities > hashtags** — consolidation and enrichment differentiate modern trends
5. **Recency matters** — ranking blends size and freshness

---

## Exercises

1. **Draw the full diagram** on paper: one box per component from tweet to trends page
2. **Clustering deep dive** — pick a [Kaggle news clustering dataset](https://www.kaggle.com/datasets?search=news+clustering), implement TF-IDF + K-means, compare cluster quality
3. **Add HTTP API** — wrap `getTrending()` in Express with `GET /trends`
4. **Entity merge** — extend `ENTITY_ALIASES` and measure duplicate reduction
5. **Recency tuning** — change `RECENCY_WEIGHT` / `VOLUME_WEIGHT` and observe rank shifts

---

## Related

- [Kafka message streams exercise](../../kafka/) — producer/consumer basics
- [Designing Twitter Trends](https://arpitbhayani.me) — original system design walkthrough (Arpit Bhayani)
