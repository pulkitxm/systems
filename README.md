# Systems

A collection of hands-on, runnable demos exploring the building blocks of distributed systems and backend infrastructure. Each folder is a self-contained project - its own `package.json` (or `docker-compose.yml`), its own README, and a focused set of scripts you can run in minutes.

The goal isn't to build a library. It's to **internalize how things actually work** by wiring them up from scratch: WAL streaming between two real Postgres containers, Lua scripts executing atomically inside Redis, a TCP server parsing its own protocol, a Bloom filter's bitset flipping one hash at a time.

> Inspired by [Arpit Bhayani](https://arpitbhayani.me/)'s system design lectures, various distributed-systems textbooks, and the pattern of "read about it, then build it small enough to fit in your head."

---

## Table of Contents

- [Who is this for](#who-is-this-for)
- [Repository Layout](#repository-layout)
- [Prerequisites](#prerequisites)
- [Suggested Learning Path](#suggested-learning-path)
- [Module Index](#module-index)
  - [Data Structures](#data-structures)
    - [`bloom-filters/`](#bloom-filters)
    - [`consistent-hashing/`](#consistent-hashing)
  - [Databases](#databases)
    - [`relationa_db_transactions/`](#relationa_db_transactions)
    - [`db-replica/`](#db-replica)
    - [`scaling-db/read-replicas/`](#scaling-dbread-replicas)
    - [`scaling-db/sharding/`](#scaling-dbsharding)
  - [Messaging & Scheduling](#messaging--scheduling)
    - [`kafka/`](#kafka)
    - [`cron-jobs/`](#cron-jobs)
    - [`implementations/notification-service/`](#implementationsnotification-service)
  - [Traffic Control](#traffic-control)
    - [`rate-limiter/`](#rate-limiter)
  - [Networking](#networking)
    - [`custom-protocol/`](#custom-protocol)
  - [Coordination](#coordination)
    - [`leader-election/`](#leader-election)
  - [AI & Agents](#ai--agents)
    - [`mcp-server/`](#mcp-server)
  - [End-to-End Implementations](#end-to-end-implementations)
    - [`implementations/abuse-masker/`](#implementationsabuse-masker)
    - [`implementations/e-commerce-product-listing/`](#implementationse-commerce-product-listing)
    - [`implementations/tinder-feed/`](#implementationstinder-feed)
- [Common Conventions](#common-conventions)
- [Troubleshooting](#troubleshooting)
- [Further Reading](#further-reading)
- [License](#license)

---

## Who is this for

- Engineers preparing for system design interviews who want concrete references beyond hand-wavy diagrams.
- Backend developers who've used Redis / Kafka / Postgres but never peeked under the hood.
- Anyone who learns better by running code than by reading whitepapers.

Each module has a **README that goes deeper than this one** - with protocol specs, algorithm derivations, ASCII architecture diagrams, and experiments to try. Start with the module that interests you and follow its README.

---

## Repository Layout

```
systems/
├── bloom-filters/                    Probabilistic set membership
├── consistent-hashing/               Key → node mapping with minimal churn
├── cron-jobs/                        BullMQ repeatable jobs on Redis
├── custom-protocol/                  Redis-RESP-like TCP protocol from scratch
├── db-replica/                       Postgres streaming replication + failover
├── implementations/
│   ├── abuse-masker/                 Real-time chat abuse masking with Trie O(n)
│   ├── e-commerce-product-listing/   End-to-end: API + master/replica routing
│   ├── notification-service/         Priority queues, bulk iteration, Bloom dedup
│   ├── tinder-feed/                  Geospatial queries, Bloom filters, match detection
│   ├── twitter-trends/               News clustering, entity trending, trends page pipeline
│   ├── url-shortener/                Base-62 encoding, ticket server IDs, KV storage
│   ├── pastebin/                     S3 blobs, derived paths, SQLite metadata, expiration
│   ├── recommendation-engine/        Content + collaborative filtering, cosine similarity, graph queries
│   ├── web-crawler/                  BFS spider, S3 batching, inverted index, domain cooldowns
│   └── fraud-detection/              Real-time Random Forest, Spark ETL, txn API, <200ms SLA
├── kafka/                            Topics, partitions, consumer groups
├── leader-election/                  Bully algorithm simulation
├── mcp-server/                       MCP server that auto-generates tools from OpenAPI
├── rate-limiter/                     4 algorithms, all atomic Lua on Redis
├── relationa_db_transactions/        12 SQL scripts: ACID, MVCC, isolation, WAL
├── scaling-db/
│   ├── read-replicas/                Read-replica routing demo
│   └── sharding/                     Horizontal sharding by key
└── README.md                         ← you are here
```

---

## Prerequisites

You won't need all of these for every module - each module's README lists exactly what it depends on.

| Tool | Used by | Notes |
|------|---------|-------|
| **Node.js** 18+ | everything | Most demos are TypeScript or plain JS |
| **pnpm** (preferred) or **npm** | everything | Install with `npm i -g pnpm` |
| **Docker** + **Docker Compose** | kafka, cron-jobs, rate-limiter, db-replica, scaling-db, relationa_db_transactions, implementations/* | Used to spin up Postgres, Redis, Kafka, etc. locally |
| **psql** *(optional)* | db modules | Handy for interactive exploration; not required since demos use the `pg` driver |
| **telnet** or **nc** *(optional)* | custom-protocol | Manual protocol testing |

Everything runs locally. There are no cloud dependencies.

---

## Suggested Learning Path

If you're new to distributed systems, here's a path from smallest-scope to largest-scope. Each one builds intuition you'll reuse in the next.

1. **[`custom-protocol/`](#custom-protocol)** - Start here. Understand how two processes talk over a socket. Everything else in this repo rides on top of ideas from here.
2. **[`bloom-filters/`](#bloom-filters)** - A self-contained data structure that shows up everywhere (caches, DB index probes, CDN).
3. **[`consistent-hashing/`](#consistent-hashing)** - The routing primitive behind shards, DHTs, and cache clusters.
4. **[`relationa_db_transactions/`](#relationa_db_transactions)** - Before you distribute a database, understand what a single-node transactional database guarantees.
5. **[`rate-limiter/`](#rate-limiter)** - Your first taste of "atomicity matters under concurrency" on Redis.
6. **[`leader-election/`](#leader-election)** - How systems agree on "one of us is in charge" without external help.
7. **[`db-replica/`](#db-replica)** - Real streaming replication between real Postgres containers. Failover included.
8. **[`kafka/`](#kafka)** - Move from request/response to event streams; see why "write once, read many" changes system design.
9. **[`cron-jobs/`](#cron-jobs)** - Durable background work. Closes the loop on queues + workers + retries.
10. **[`scaling-db/sharding/`](#scaling-dbsharding)** - Partitioning data when a single node isn't enough.
11. **[`implementations/e-commerce-product-listing/`](#implementationse-commerce-product-listing)** - Tie it together in a tiny app with read/write splitting.

Skip around freely - nothing is hard-gated on anything else. This is just one sensible order.

---

## Module Index

Each module below links to its own README, which is where the real content lives.

### Data Structures

#### [`bloom-filters/`](./bloom-filters)

A probabilistic set membership structure that answers "is X in the set?" with two states: **definitely not** or **might be**. Implemented in TypeScript from scratch, plus a demo of the RedisBloom module.

**What you'll learn**
- Why Bloom filters trade memory for a tunable false-positive rate.
- How to pick `m` (bit array size) and `k` (hash function count) for a target FP rate.
- Where Bloom filters fit in real systems: caches, LSM-tree SSTables, CDN cache lookups, spam filters, username availability checks.

**Quick start**

```bash
cd bloom-filters
pnpm install
pnpm demo              # basic behavior
pnpm false-positive    # watch FP rate climb as the filter fills
pnpm redis             # RedisBloom module version (requires redis-stack)
```

---

#### [`consistent-hashing/`](./consistent-hashing)

Implementation of the ring-based consistent hashing algorithm, with virtual nodes for even distribution.

**What you'll learn**
- Why `hash(key) % N` is catastrophic when `N` changes, and consistent hashing only moves `~k/N` keys.
- The ring model: nodes placed at hash positions, keys assigned to the first node clockwise.
- Why naive consistent hashing gives uneven distribution, and how virtual nodes fix it.
- Real-world usage: Amazon Dynamo, Cassandra, Memcached clients, CDNs.

**Quick start**

```bash
cd consistent-hashing
pnpm install
pnpm demo            # key ownership + adding/removing nodes
pnpm scale           # compare simple hash vs consistent hash under scaling
pnpm virtual-nodes   # distribution with/without virtual nodes
```

---

### Databases

#### [`relationa_db_transactions/`](./relationa_db_transactions)

Twelve annotated SQL scripts that walk you through transaction internals in PostgreSQL. No application code - just `psql` and a single Postgres container.

**What you'll learn**
- ACID properties made concrete: atomicity, consistency, isolation, durability.
- All four SQL isolation levels with dirty reads, non-repeatable reads, phantom reads, and write skew demonstrated in side-by-side sessions.
- MVCC internals via `xmin` / `xmax` visible row versions.
- Deadlocks, savepoints, and the Write-Ahead Log.
- Retry logic patterns for serialization failures.

**Quick start**

```bash
cd relationa_db_transactions
docker-compose up -d
docker exec -i transactions_db psql -U admin -d transactions_db < 01_basic_transaction.sql
```

Several scripts are two-terminal exercises (concurrent sessions) - the script header tells you which.

---

#### [`db-replica/`](./db-replica)

Two real Postgres containers, streaming replication over WAL, and a manual-failover script. This is the most detailed module in the repo.

**What you'll learn**
- Why the replica is **read-only by design** (the `standby.signal` file, not a config flag).
- How `pg_basebackup -R` bootstraps a replica and configures it to follow the primary.
- The WAL sender / WAL receiver / startup-process trio on both sides of the connection.
- LSNs (log sequence numbers) - how to tell exactly how far behind a replica is.
- Async vs sync replication trade-offs.
- Manual failover with `pg_promote()` and what that means for application connection strings.
- What happens during network partitions, and the role of `wal_keep_size`.

**Quick start**

```bash
cd db-replica
docker compose up -d
sleep 10
pnpm install
pnpm run demo            # basic replication
pnpm run failover        # kill primary, promote replica, write to it
```

---

#### [`scaling-db/read-replicas/`](./scaling-db/read-replicas)

A simpler take on read-replicas focused on **query routing**: writes to primary, reads distributed across replicas.

**What you'll learn**
- Routing reads vs writes at the application layer.
- When read-your-own-writes gets in the way, and how session pinning mitigates it.

**Quick start**

```bash
cd scaling-db/read-replicas
docker compose up -d
pnpm install
pnpm setup
pnpm populate
pnpm demo
```

---

#### [`scaling-db/sharding/`](./scaling-db/sharding)

Horizontal partitioning across multiple Postgres instances by a shard key, with an application-side shard manager.

**What you'll learn**
- How to pick a shard key (and what happens when you pick badly: hot spots, cross-shard joins, rebalancing pain).
- Routing writes and reads to the right shard.
- Cross-shard queries: how scatter/gather works.
- Why resharding is the nightmare people warn you about.

**Quick start**

```bash
cd scaling-db/sharding
docker compose up -d
npm install
npm run setup
npm run populate
npm run demo
npm run query   # example single-shard vs cross-shard queries
```

---

### Messaging & Scheduling

#### [`kafka/`](./kafka)

A blog-publishing system using Kafka: one producer, two independent consumer groups (search indexer + per-user post counter), multiple partitions.

**What you'll learn**
- The **core mental shift** from queues to streams: messages aren't deleted after consumption; consumer groups commit offsets.
- Why Kafka solves the "dual-write problem" (one topic → many consumer groups → no inconsistency if the API crashes between writes).
- Partitions as the unit of parallelism, with partition keys preserving per-key ordering.
- Consumer group rebalancing: what happens when you start a second consumer in the same group.
- Offset management: stop a consumer, restart it, watch it resume from where it left off.

**Quick start**

```bash
cd kafka
docker-compose up -d          # Kafka + Kafka UI on :8080
pnpm install
pnpm run search-consumer      # terminal 1
pnpm run counter-consumer     # terminal 2
pnpm run producer             # terminal 3
```

---

#### [`cron-jobs/`](./cron-jobs)

Production-style cron scheduling with BullMQ on Redis. The key insight: **there's no scheduler daemon** - repeatable jobs are just delayed jobs that re-add themselves when executed.

**What you'll learn**
- Why BullMQ beats `node-cron` / `setInterval` for anything that matters: persistence, retries with backoff, concurrency limits, stalled-job detection, deduplication, graceful shutdown.
- Idempotent schedule registration - safe to run on every deploy.
- Worker failure & recovery: jobs don't pile up when workers are down.
- Schedule reconciliation: syncing a "source of truth" database with Redis runtime state.

**Quick start**

```bash
cd cron-jobs
docker-compose up -d          # Redis + Redis Commander on :8081
pnpm install
pnpm run add-schedule         # register 4 sample schedules
pnpm run worker               # process them
pnpm run list-schedules
```

---

#### [`implementations/notification-service/`](./implementations/notification-service)

A comprehensive system design guide and TypeScript implementation of a scalable notification service. Covers templates, priority queues (P1/P2/P3), bulk iteration, and Bloom filter deduplication. Simulates Resend, Twilio, Firebase, and APNS providers.

**What you'll learn**
- **Day zero to production**: evolve from synchronous single-user flow to fully async, horizontally scalable architecture.
- **Asynchronous architecture**: control service enqueues, returns immediately; workers send via provider SDKs later.
- **The starvation problem**: why a single queue fails and how priority queues (P1/P2/P3) solve it.
- **Bulk notification pattern**: iterator workers read from a users replica, expand jobs into individual messages, avoiding control service bottleneck.
- **The deduplication problem**: naive tracking vs Bloom filters - storage math (4 GB → 114 MB for 100M users), trade-offs, and where to deduplicate.
- **Design principles**: separation of concerns, dumb workers, queue decoupling, trading accuracy for efficiency.

**Quick start**

```bash
cd implementations/notification-service
pnpm install
docker-compose up -d        # Redis Stack with Bloom filter support
pnpm demo:single            # single notification flow
pnpm demo:bulk              # bulk campaign with iterator
pnpm demo:priority          # P1 bypasses P3 congestion
pnpm demo:dedup             # Bloom filter prevents duplicates
pnpm demo:all               # complete walkthrough
```

---

### Traffic Control

#### [`rate-limiter/`](./rate-limiter)

Four rate-limiting algorithms - Fixed Window, Sliding Window Log, Sliding Window Counter, Leaky Bucket - each implemented as a single atomic Lua script running inside Redis.

**What you'll learn**
- The **naive race condition**: why `GET → check → INCR` leaks requests under concurrency (demonstrated with 20 concurrent requests blowing past a limit of 5).
- Why `EVAL` (Lua) wraps the read-check-write into a single atomic operation.
- Trade-offs at a glance:

  | Algorithm | Memory | Accuracy | Burst handling |
  |---|---|---|---|
  | Fixed Window | 1 counter / user / window | approximate | allows 2× burst at window boundary |
  | Sliding Log | N timestamps / user | exact | no edge burst |
  | Sliding Counter | 2 counters / user | approximate | smooths edge burst |
  | Leaky Bucket | level + timestamp | exact outflow | enforces steady downstream rate |

**Quick start**

```bash
cd rate-limiter
pnpm install
docker-compose up -d
pnpm fixed-window
pnpm sliding-log
pnpm sliding-counter
pnpm leaky-bucket
pnpm race-condition   # naive vs Lua: always exactly 5 vs sometimes more
pnpm all              # same workload, all four algorithms, side by side
```

---

### Networking

#### [`custom-protocol/`](./custom-protocol)

A Redis-RESP-style, text-based, line-delimited protocol on top of raw TCP. Implements `SET`, `GET`, `DEL`, `PING`, `QUIT` with simple strings, errors, and bulk strings.

**What you'll learn**
- How two processes agree on a wire format - the quiet assumption behind every HTTP call, Redis command, and database driver.
- Request framing (why `\n` or length-prefixing matters).
- Why databases and queues often invent their own protocols instead of using HTTP: no header overhead, purpose-built parsing, far lower latency per op.
- The costs: no browser tooling, no Postman, every client has to be written by hand.

**Quick start**

```bash
cd custom-protocol
npm install
npm run build
npm run server        # terminal 1
npm run client        # terminal 2
# or: telnet localhost 9999
```

---

### Coordination

#### [`leader-election/`](./leader-election)

The **Bully Algorithm** simulated on a single machine using timers to mimic independent processes. Start with 5 nodes, kill the leader, watch a new one get elected.

**What you'll learn**
- Why "who monitors the monitor?" is infinite recursion, and leader election is the **base case** that stops it.
- Heartbeats, randomized election timeouts (to avoid simultaneous-election storms), `ELECTION` / `OK` / `COORDINATOR` messages.
- Why the Bully algorithm is simple but chatty, and when you'd reach for Raft or Paxos instead.
- Where leader election shows up in production: etcd, Kafka controller, Patroni, Redis Sentinel, Consul.

**Quick start**

```bash
cd leader-election
node demo.js               # high-level simulation
node bully-algorithm.js    # fuller implementation with message types + delays
```

---

### AI & Agents

#### [`mcp-server/`](./mcp-server)

A tiny [Model Context Protocol](https://modelcontextprotocol.io) server that wraps a Hono + OpenAPI API and auto-generates one MCP tool per allowed route. Add a route to the REST API, restart, and the new tool shows up in `tools/list` on the next connection. No hand-maintained tool catalogue.

**What you'll learn**

- What MCP is in plain terms: tools (model-callable functions), resources (pinned read-only data), prompts (slash-style workflow shortcuts).
- How to turn an OpenAPI document into MCP tool definitions - names, titles, descriptions, and input schemas - without writing them twice.
- Why running the MCP handler in the same process as your REST API means you reuse every middleware, validator, and auth check you already wrote.
- The deny list pattern: filter dangerous routes (admin, auth, webhooks, credentials) before registration so they never appear to the model.
- Stateless JSON-RPC over HTTP: `initialize`, `tools/list`, `tools/call`, `resources/list`, `prompts/list` as plain POSTs, no SSE required.

**Quick start**

```bash
cd mcp-server
pnpm install

pnpm server          # terminal 1: starts the server on :3333
pnpm demo            # terminal 2: walks through initialize → list tools → call tools
```

Companion blog post: [An MCP Server That Writes Itself](https://pulkitxm.com/blogs/mcp-server-that-writes-itself).

---

### End-to-End Implementations

#### [`implementations/abuse-masker/`](./implementations/abuse-masker)

Real-time abuse masking for live stream chat using a Trie data structure. Socket.IO server with CLI client. Demonstrates why not everything needs to be a microservice.

**What you'll learn**
- **Trie data structure**: character-by-character string matching without tokenization.
- **O(n) masking algorithm**: single-pass traversal of message and trie simultaneously.
- **Why NOT a separate service**: network calls add milliseconds, trie lookups take microseconds. For pure computation, keep it in-memory.
- **Socket.IO rooms**: broadcast abstraction for real-time chat.
- **Load once, use forever**: fetch abuse dictionary on startup, then pure in-memory operations.

**Quick start**

```bash
cd implementations/abuse-masker
bun install
bun server          # terminal 1
bun client          # terminal 2
bun client          # terminal 3
```

---

#### [`implementations/e-commerce-product-listing/`](./implementations/e-commerce-product-listing)

A tiny product catalog backend - Express, Postgres primary + replica, read-heavy traffic - that wires together lessons from **`db-replica/`** and **`scaling-db/read-replicas/`**.

**Key design decision:** the master handles reads **too**. Since writes are rare (shop owner edits), there's spare capacity for reads. Customer reads are distributed 50/50 between master and replica. Each query is tagged `[MASTER :5432]` or `[REPLICA:5433]` in the logs so you can watch the routing live.

**What you'll learn**
- How to actually route a connection pool: separate pools for writes vs reads, random distribution across replicas.
- Why "only read from replicas" isn't a law - you route reads based on your actual write volume.
- A realistic replication status endpoint for monitoring.

**Quick start**

```bash
cd implementations/e-commerce-product-listing
docker compose up -d
sleep 10
pnpm install
node src/init-db.js
node src/seed.js
node src/server.js
# then: curl http://localhost:3000/products
```

---

#### [`implementations/tinder-feed/`](./implementations/tinder-feed)

Location-based feed system demonstrating geospatial queries, Bloom filter deduplication, and match detection. Implements the core mechanics of a Tinder-like swipe-based matching application.

**What you'll learn**
- **Redis geospatial commands**: GEOADD, GEORADIUS, GEODIST for proximity queries.
- **Why data size isn't the problem**: 600MB for 50M users is trivial; query load (1.67M writes/sec) is the real challenge.
- **Bloom filters for "definitely not seen"**: Zero false negatives guarantee previously-swiped profiles never reappear.
- **Feed database design trade-offs**: Store candidate ID (extra network call) vs full profile (stale data risk).
- **Why NOT store as a list**: Document size limits, serialization costs, unbounded growth.
- **Async feed generation**: Queue-based pattern for non-blocking user experience.
- **Match detection**: Simple bidirectional interest check in feed database.

**Quick start**

```bash
cd implementations/tinder-feed
pnpm install
docker-compose up -d
pnpm init
pnpm seed
pnpm demo:all
```

---

#### [`implementations/twitter-trends/`](./implementations/twitter-trends)

Twitter Trends page pipeline: Kafka ingestion, news URL filtering/enrichment, TF-IDF + K-means clustering in Elasticsearch, entity extraction and scoring, and a precomputed trends serving layer.

**What you'll learn**
- **Why a simple UI needs many services**: Ingestion, clustering, trending, and read-optimized serving are separate concerns.
- **Kafka as the tweet firehose**: Durability and multiple consumers on one stream.
- **News clustering**: TF-IDF feature vectors, K-means grouping, Elasticsearch for NL queries.
- **Entity trending (not hashtags)**: NER-style extraction, time-windowed aggregation, alias merging.
- **Read/write split**: Heavy batch job writes `trends:current`; API reads precomputed data.

**Quick start**

```bash
cd implementations/twitter-trends
pnpm install
docker compose up -d
pnpm init
pnpm seed
pnpm demo:all
```

---

#### [`implementations/url-shortener/`](./implementations/url-shortener)

URL shortener with pseudo-random short codes: compares hash vs integer vs custom base-62 encoding, shuffled 6-bit character map, range-partitioned ticket server for unique non-sequential IDs, and KV storage sharded by `short_code`.

**What you'll learn**
- **Why SHA-256 fails**: 16-char codes, deterministic (no per-user analytics)
- **Why raw integer IDs fail**: predictable scraping (`/1729` → `/1730`)
- **Custom encoding**: 62 chars = 6 bits; pad binary ID, map through secret shuffled alphabet
- **Ticket server**: partition ID ranges, pick range at random, atomic increment — pseudo-random without collisions
- **Sharding for load**: ~12.8 GB/month for 100M URLs is small; shard by `short_code` for QPS

**Quick start**

```bash
cd implementations/url-shortener
pnpm install
docker compose up -d
pnpm init
pnpm demo:all
```

---

#### [`implementations/pastebin/`](./implementations/pastebin)

Pastebin / GitHub Gist: store text up to 10MB on blob storage (simulated S3), metadata in SQLite, derived S3 paths never stored in DB, expiration with batch cleanup.

**What you'll learn**
- **Don't store derivables**: S3 path = `gist-paste/{owner_id}/{uid}` computed at runtime
- **Capacity math**: 100 TB/month blobs → S3; 1.6 GB/month meta → relational DB
- **Cost-effective design**: skip caching 10MB files on infrequent reads (1:50 ratio)
- **Expiration**: 404 on read if expired; cleanup job batch-deletes MetaDB + blobs

**Quick start**

```bash
cd implementations/pastebin
pnpm install
pnpm init
pnpm demo:all
```

---

#### [`implementations/recommendation-engine/`](./implementations/recommendation-engine)

Amazon-style recommendation engine: naive popular items, content filtering (TF-IDF + K-means exploitation), collaborative filtering (user cohorts + graph queries for exploration), and blended feeds.

**What you'll learn**
- **Why naive fails**: same top-10 for everyone, recommends already-purchased items
- **Content filtering**: cluster products by features; cosine similarity for "more like this"
- **Collaborative filtering**: cluster users; graph query for items similar users bought
- **Blended feed**: mix exploitation (60%) + exploration (40%)

**Quick start**

```bash
cd implementations/recommendation-engine
pnpm install
pnpm run init
pnpm run seed
pnpm run demo:all
```

---

#### [`implementations/web-crawler/`](./implementations/web-crawler)

Internet-scale web crawler: BFS spider from seed URLs, time-partitioned local staging → zip batches on S3, Spark-style HTML tokenization, inverted index (~320 TB estimate), per-domain crawl cooldowns.

**What you'll learn**
- **Work backwards:** inverted index → extraction pipeline → S3 batching → crawler
- **Capacity math:** 1B pages × 1M words → ~320 TB — requires distributed KV (DynamoDB)
- **Batching:** never one S3 PUT per page; daemon zips 5-minute partitions
- **Coordination:** URLs DB with domain partition + last-5 crawls + cooldown

**Quick start**

```bash
cd implementations/web-crawler
pnpm install
pnpm init
pnpm seed
pnpm demo:all
```

---

#### [`implementations/fraud-detection/`](./implementations/fraud-detection)

Real-time bank fraud detection: transaction API with status lifecycle, synchronous Random Forest classifier (<200ms SLA), Spark-style ETL from transaction + customer-support DBs to S3, MLlib-style training pipeline.

**What you'll learn**
- **Sync fraud check:** Bank API blocks until fraud service returns — not async
- **Random Forest:** Multiple decision trees (different features) → majority vote
- **Training labels:** Customer support tickets mark fraud after user calls
- **Big data role:** Spark joins huge DBs → S3; MLlib trains at scale; model loaded on service boot

**Quick start**

```bash
cd implementations/fraud-detection
pnpm install
pnpm init
pnpm seed
pnpm demo:all
```

---

## Common Conventions

A few patterns repeat across modules so the whole repo feels consistent.

**Package manager.** `pnpm` is preferred; `npm` works for anything with a lockfile. A couple of older modules still use `npm`.

**Type checking.** Every folder that ships a `tsconfig.json` exposes `pnpm run type-check` (`tsc --noEmit`). To verify all TypeScript modules at once from the repo root:

```bash
./scripts/typecheck-all.sh
```

**Entry scripts.** Most modules expose commands via `package.json` scripts - `pnpm demo`, `pnpm run worker`, etc. Check each module's README for the full list.

**Docker.** Anything that needs Redis, Kafka, or Postgres ships a `docker-compose.yml` so you don't pollute your system. Always `docker compose down -v` when you're done to reclaim volumes.

**Ports.** Each module tries to pick unused ports, but conflicts happen if you run two at once. Relevant defaults:
- Redis: `6379`
- Redis Commander / Kafka UI: `8080` / `8081`
- Postgres primary: `5432`
- Postgres replica: `5433`
- Custom-protocol server: `9999`
- E-commerce backend: `3000`

**Logs over UIs.** Every demo prints heavily - which node got the write, which partition received the message, which replica served the read. Read the terminal, not just the UI.

**Self-contained.** You can `rm -rf` any top-level folder without breaking anything else.

---

## Troubleshooting

**"Port already allocated"**

Another container or local service is holding the port. List usage and stop the offender:

```bash
lsof -i :5432        # or whichever port
docker ps            # look for the relevant container
docker stop <id>
```

**Docker Compose says `version` is obsolete**

Harmless warning on newer Compose versions. Ignore, or remove the `version:` line from the YAML.

**Postgres replica won't connect**

```bash
docker logs pg_replica
docker logs pg_primary
```

Common causes: `pg_hba.conf` not allowing the replicator user, the primary hasn't finished its init scripts yet, or a stale data volume from a previous run. `docker compose down -v` and start fresh.

**Redis commands "succeed" but limits leak**

You're probably using a naive GET/INCR flow instead of a Lua script. See `rate-limiter/` → `pnpm race-condition` for the demonstration and fix.

**pnpm complains about lockfile / workspace**

Each subfolder is an independent project. Run commands from **inside** the relevant folder, not from the repo root.

---

## Further Reading

Things that informed this repo, roughly in order of "how much they shaped my thinking":

- **Arpit Bhayani** - [arpitbhayani.me](https://arpitbhayani.me/) - the lecture series this repo started as homework for.
- **Designing Data-Intensive Applications** - Martin Kleppmann. If you read only one book on this topic, read this one.
- **Database Internals** - Alex Petrov. Goes deeper on storage engines, B-trees, LSM trees, and replication.
- **PostgreSQL docs** - specifically the chapters on [high availability](https://www.postgresql.org/docs/current/high-availability.html), [WAL](https://www.postgresql.org/docs/current/wal-intro.html), and [MVCC](https://www.postgresql.org/docs/current/mvcc-intro.html).
- **Kafka: The Definitive Guide** - for going deeper than the `kafka/` module.
- **Redis in Action** and the Redis command docs - especially the sections on Lua scripting and keyspace design.

Companion write-ups for many demos live on the blog: [System Design](https://pulkitxm.com/series/system-design). Each module README links to its closest post where one exists.

---

## License

MIT. Use any of this as you like - take ideas, copy snippets into your own projects, fork and extend. Attribution appreciated but not required.
