# Recommendation Engine System Design

> **Motive:** Understand ML systems, plug-and-play patterns, and where graph databases shine in recommendation pipelines.

Design a recommendation engine for Amazon-like product discovery. Consumer platforms (YouTube, Amazon, Spotify) live on recommendations — but a naive "most popular items for everyone" approach fails. This implementation covers **three approaches** and a **blended feed**.

---

## TL;DR

- **Naive:** Top N by global order count — same for everyone, no personalization
- **Content filtering (exploitation):** Cluster products by TF-IDF features → recommend similar items to what user viewed
- **Collaborative filtering (exploration):** Cluster users by behavior → graph query for items similar users bought but you didn't
- **Cosine similarity:** Measure closeness of n-dimensional feature vectors (θ → 0 ⇒ cos → 1)
- **Blended feed:** Mix exploitation + exploration (e.g. 60/40)

---

## Problem Statement

Recommend products users are **likely to buy** — personalized, not generic.

| Naive flaw | Example |
|------------|---------|
| Same for all | Alice and Dave see identical top 10 |
| Already purchased | iPhone shown after you bought iPhone |
| Irrelevant | Budget buyer sees ₹1,50,000 laptop |

**Hence:** personalization via ML + graph queries.

---

## Architecture

```
Product DB ──┐
Orders DB ─┼──▶ Read, Filter, Ingest ──▶ S3 (data lake)
Browsing ──┘                              │
                                          ▼
                              ┌───────────────────────┐
                              │ Clustering (K-means)  │
                              │  - Product clusters   │
                              │  - User cohorts       │
                              └───────────┬───────────┘
                                          │
User ──▶ Recommendation Service ◀─────────┘
              │
              ├── Content filtering (exploit)
              ├── Collaborative + Graph (explore)
              └── Blended output
```

---

## Deep Dive: Naive Approach

```typescript
// COUNT orders GROUP BY product_id ORDER BY cnt DESC
getPopularRecommendations(userId) // same list regardless of userId
```

Quick and dirty — useful as a baseline only.

---

## Deep Dive: Content Filtering (Exploitation)

**Philosophy:** Give people more of what they already consume.

1. Filter products (rating ≥ 3)
2. TF-IDF vectors from `title + description + category + tags`
3. K-means clustering → product groups (electronics, books, …)
4. On product page view: return other items from same cluster (cosine similarity ranking)
5. Filter out already-purchased items

```typescript
// User viewing iPhone → cluster "electronics/phones" → AirPods, Galaxy, Sony headphones
getContentRecommendations(userId, anchorProductId, model)
```

**Pipeline (production):** ProductDB + OrdersDB → Spark jobs → S3 → Spark MLlib K-means → model on S3 → Recommendation Service loads model.

---

## Deep Dive: Cosine Similarity

Convert each product to an **n-dimensional vector** (one dimension per feature/token).

```
cos(θ) = (A · B) / (|A| × |B|)

θ → 0°   → cos → 1   (very similar)
θ → 90°  → cos → 0   (orthogonal / dissimilar)
```

Alternative: **Euclidean distance** — smaller distance = closer in feature space.

```bash
pnpm demo:similarity
```

---

## Deep Dive: Collaborative Filtering (Exploration)

**Philosophy:** Recommend what **similar users** purchased — discover new categories.

1. Build user vectors from order categories + browsing + avg spend
2. K-means → user cohorts (overlapping interests)
3. Load purchases into **graph** (simulates Neo4j)
4. Graph query: similar users → their purchases minus yours
5. Rank by how many similar users bought each candidate

```typescript
// Alice bought iPhone; Bob (similar) bought MacBook → recommend MacBook to Alice
graph.findCandidatesFromSimilarUsers(userId, similarUserIds)
```

**Why graph DB?** Query pattern is inherently graph-shaped:
`(User)-[:SIMILAR]->(User)-[:PURCHASED]->(Product)` where target user has NOT purchased Product.

---

## Deep Dive: Blended Feed

A good feed is **not** 100% exploitation or 100% exploration:

| Type | Ratio | Purpose |
|------|-------|---------|
| Exploitation | ~60% | Safe, similar to past behavior |
| Exploration | ~40% | Discovery, platform retention |

```typescript
getBlendedRecommendations(userId, limit, exploitationRatio = 0.6)
```

---

## File Structure

```
recommendation-engine/
├── README.md
├── package.json
└── src/
    ├── data/                 # SQLite: products, orders, browsing
    ├── naive/                # Popular items
    ├── content-filtering/    # TF-IDF + K-means products
    ├── collaborative-filtering/  # User clusters + graph store
    ├── similarity/           # Cosine + Euclidean
    ├── service/              # Blended recommendation service
    ├── scripts/              # init, seed
    └── demos/
```

---

## Design Decisions Summary

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Product features | TF-IDF on text metadata | Standard content-filtering baseline |
| Similarity metric | Cosine similarity | Angle-based; works in high dimensions |
| User similarity | Order + browsing vectors | Behavior-based cohorts |
| Graph store | In-memory adjacency list | Demos Neo4j query patterns without infra |
| Low-rated products | Filtered at ingest | Don't recommend rating < 3 |
| Production clustering | Spark + MLlib on S3 | Scale beyond single-node K-means |

---

## Setup

No Docker required.

```bash
cd implementations/recommendation-engine
pnpm install
pnpm run init
pnpm run seed
pnpm run demo:all
```

---

## Demos

| Script | What it shows |
|--------|----------------|
| `pnpm run demo:naive` | Same popular list for all users |
| `pnpm run demo:similarity` | Cosine math + product vector similarity |
| `pnpm run demo:content` | Product clusters + exploitation recs |
| `pnpm run demo:collab` | User cohorts + graph query |
| `pnpm run demo:all` | All approaches + blended feed |

---

## Key Takeaways

1. **Naive fails** — popularity ≠ personalization
2. **Exploitation** — content filtering, product clusters, cosine similarity
3. **Exploration** — collaborative filtering, user cohorts, graph queries
4. **Graph DBs** — natural fit for "similar users bought X but I didn't"
5. **Blend both** — real feeds mix exploitation and exploration

---

## Exercises

1. Draw the full pipeline: ProductDB → S3 → clustering → Recommendation Service
2. Write Neo4j Cypher for the collaborative filtering graph query
3. Tune `EXPLOITATION_RATIO` and compare feed diversity for the same user
4. Add browsing history weighting to user vectors
5. Implement rating prediction (collaborative filtering matrix factorization stub)

---

## Related

- [Designing a Recommendation Engine](https://arpitbhayani.me) — Arpit Bhayani system design series
- [twitter-trends](../twitter-trends/) — K-means + TF-IDF clustering reference
