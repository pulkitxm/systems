# Pastebin / GitHub Gist System Design

> **Motive:** Do not store what you can derive. Design for **minimum cost**, not “add cache everywhere.”

Pastebin and GitHub Gist let users store text, share via unique URLs (public or secret), set expiration, and edit their pastes. Max file size: **10 MB**. Scale: **~10 million writes/month**.

---

## TL;DR

- **Blob content → S3** (100 TB/month at worst case) — not in relational DB
- **Metadata → relational DB** (~1.6 GB/month) — `uid`, `name`, `createdAt`, `visibility`, `owner_id`
- **S3 path is derived** — `s3://gist-paste/{owner_id}/{uid}` — never stored in MetaDB
- **Read via API** — authorization, expiration checks; no direct S3 URLs to users
- **Expired pastes** — 404 on read; **cleanup job** hard-deletes from MetaDB + S3 in batches
- **Skip caching 10 MB files** — read ratio ~1:50; not read-heavy

---

## Problem Statement

| Feature | Detail |
|---------|--------|
| Store text | Up to 10 MB per paste |
| Share | Public (listed) or secret (link-only) |
| Unique URL | `gist.example.com/{uuid}` |
| Expiration | Auto-delete after TTL |
| Edit | Owner can update content |
| Out of scope | Custom domains, full CDN |

---

## Storage Decision (Number Crunching)

| Metric | Value |
|--------|-------|
| Writes/month | 10M |
| Max file | 10 MB (worst case) |
| Blob storage/month | 10M × 10 MB = **~100 TB** |
| Read ratio | 1:50 |
| Read bandwidth/month | 100 TB × 50 = **~5 PB** |
| Meta per row | ~168 bytes (36 + 120 + 12) |
| Meta storage/month | 10M × 168 B ≈ **1.6 GB** |

**Conclusion:** Files belong in **S3** (or blob store). Metadata fits easily in a **relational DB**. Shard for **load**, not because 1.6 GB is large.

---

## Architecture

```
┌──────────┐     ┌─────────────┐     ┌──────────────┐
│  User    │────▶│ Load Balancer│────▶│ API Servers  │
└──────────┘     └─────────────┘     └──────┬───────┘
                                            │
                    ┌───────────────────────┼───────────────────────┐
                    ▼                       ▼                       ▼
             ┌─────────────┐        ┌─────────────┐        ┌─────────────┐
             │   MetaDB    │        │  S3 / Blobs │        │   Kafka     │
             │ (relational)│        │  file body  │        │ (analytics) │
             └─────────────┘        └─────────────┘        └──────┬──────┘
                                                                   ▼
                                                            ┌─────────────┐
                                                            │Elasticsearch│
                                                            └─────────────┘
```

---

## Deep Dive: Derived S3 Path

**Rule #1:** If you can derive it, do not store it.

MetaDB schema (`store`):

| Column | Purpose |
|--------|---------|
| uid | UUID (paste ID) |
| name | Display filename |
| created_at | Timestamp |
| visibility | PUBLIC \| SECRET |
| owner_id | Uploader |
| expires_at | Optional TTL |

**No `s3_path` column.**

```typescript
// src/storage/path.ts
deriveS3Path(ownerId, uid) → `s3://gist-paste/${ownerId}/${uid}`
```

### Upload flow

1. User POSTs file to API server
2. API generates UUID
3. API uploads to S3 at **derived path** (`owner_id/uid`)
4. API inserts row in MetaDB
5. Returns `https://gist.example.com/{uid}`

### Read flow

1. Request `gist.example.com/{uid}` → API server
2. Lookup MetaDB by `uid`
3. If expired → **404**
4. Derive S3 path from `owner_id` + `uid`
5. Read blob from S3 → return content
6. (Production) push access event to Kafka

---

## Deep Dive: Expiration & Cleanup

**On read:** Check `expires_at` in MetaDB before touching S3. Expired → 404.

**Cleanup job:** Periodically scan MetaDB for `expires_at < now`, delete in **batches** (e.g. 100 rows):

- Delete blob from S3
- Delete row from MetaDB

Hard delete — no archive for sensitive one-time passwords.

```bash
pnpm demo:cleanup   # batch vs single-row timing comparison
```

---

## Deep Dive: Why Not Cache Everything?

- Read ratio ~1:50 — not read-heavy (unlike a feed or timeline)
- Max file 10 MB — caching in Redis wastes RAM for rarely accessed data
- **If** you cache: only small files (<1–2 KB) with steady access patterns (needs analytics)

Default: serve occasional reads from S3/DB directly — simpler and cheaper.

---

## Deep Dive: Analytics (Production)

On each read, API extracts IP, user-agent, location from headers → **Kafka** → consumers → **Elasticsearch** → Kibana/custom UI.

- Recent stats for paying users
- **Archiver job:** move data older than 6 months to S3 → keep ES cluster small and cheap

**This demo:** SQLite `access_events` table as a lightweight stub.

---

## File Structure

```
pastebin/
├── README.md
├── package.json
└── src/
    ├── storage/
    │   ├── capacity.ts      # 100TB / 1.6GB math
    │   ├── path.ts          # derived S3 path
    │   ├── meta-db.ts       # SQLite store table
    │   └── blob-store.ts    # local S3 simulation
    ├── paste-service.ts     # create / read / edit
    ├── jobs/cleanup.ts      # batch expiration cleanup
    ├── analytics/access-log.ts
    ├── scripts/             # init, seed
    └── demos/
```

---

## Design Decisions Summary

| Decision | Choice | Rationale |
|----------|--------|-----------|
| File storage | S3 / blob store | 100 TB/month too large for DB rows |
| Metadata | Relational DB | ~1.6 GB/month, simple queries |
| S3 path | Derived | Save space; single source of truth |
| Paste URL | `{base}/{uuid}` | UUID is already in MetaDB |
| Expired read | 404 via API | All reads go through API |
| Delete | Batch cleanup job | Simple; hard delete sensitive data |
| Cache | Skip by default | Low read frequency, large files |

---

## Setup

No Docker required — SQLite + local filesystem.

```bash
cd implementations/pastebin
pnpm install
pnpm init
pnpm seed
pnpm demo:all
```

Data lives in `data/pastebin.db` and `data/blobs/{owner_id}/{uid}`.

---

## Demos

| Script | What it shows |
|--------|----------------|
| `pnpm demo:capacity` | 100 TB vs 1.6 GB storage decision |
| `pnpm demo:storage` | Schema without s3_path; derived paths |
| `pnpm demo:paste` | Create, read, edit, expiration 404 |
| `pnpm demo:cleanup` | Batch delete + performance comparison |
| `pnpm demo:all` | End-to-end |

---

## Key Takeaways

1. **Don't store derivables** — S3 path from `owner_id` + `uid`
2. **Use numbers** — 100 TB blobs vs 1.6 GB meta drives architecture
3. **Cost over cache reflex** — question every cache before adding infra
4. **Simple cleanup** — periodic batch job beats over-engineering
5. **API gateway** — expiration, auth, analytics at the edge

---

## Exercises

1. Draw upload + read flows on paper including derived path
2. Add Express API with `POST /pastes` and `GET /pastes/:uid`
3. Mock 1000 access events and write Elasticsearch aggregation queries (document in README)
4. Run `demo:cleanup` and compare batch sizes 1 vs 100 vs 1000 on 10k rows
5. Implement archiver stub: move `access_events` older than N days to JSON files in `data/archive/`

---

## Related

- [Designing PasteBin](https://arpitbhayani.me) — Arpit Bhayani system design series
