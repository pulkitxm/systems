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
    - [`implementations/e-commerce-product-listing/`](#implementationse-commerce-product-listing)
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
│   ├── e-commerce-product-listing/   End-to-end: API + master/replica routing
│   └── notification-service/         Priority queues, bulk iteration, Bloom dedup
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

A scalable notification service with templates, priority queues (P1/P2/P3), bulk iteration, and Bloom filter deduplication. Simulates Resend, Twilio, Firebase, and APNS providers.

**What you'll learn**
- **Asynchronous architecture**: control service enqueues, returns immediately; workers send via provider SDKs later.
- **Priority queues prevent starvation**: P1 (transactional) notifications never blocked by P3 (marketing) campaigns.
- **Bulk notification pattern**: iterator workers read from a users replica, expand jobs into individual messages, avoiding control service bottleneck.
- **Bloom filter deduplication**: prevents duplicate sends when iterator crashes and restarts. False positives (skip a user) acceptable for marketing; false negatives (duplicates) impossible.
- **Workers are dumb**: receive fully-populated messages with contact info, body, subject - no database calls, no business logic.

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

Companion blog post: [Designing and Scaling Notifications](https://pulkitxm.com/series/system-design/notification-service).

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
