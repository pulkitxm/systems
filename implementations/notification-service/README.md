# Notification Service

TypeScript implementation of a scalable notification service with priority queues, bulk processing, and Bloom filter deduplication.

For architecture deep dive, design decisions, and scaling patterns, see the companion blog post: [Designing and Scaling Notifications](https://pulkitxm.com/series/system-design/notification-service)

## Architecture

```
┌─────────────────┐     ┌───────────────────┐     ┌─────────────────────┐
│     Control     │────▶│   Priority Queues │────▶│      Workers        │
│     Service     │     │   P1 / P2 / P3    │     │  (Resend, Twilio,   │
└─────────────────┘     └───────────────────┘     │   Firebase, APNS)   │
        │                                         └─────────────────────┘
        │ bulk jobs
        ▼
┌─────────────────┐     ┌───────────────────┐
│    Iterator     │────▶│   Bloom Filter    │
│    Workers      │     │  (deduplication)  │
└─────────────────┘     └───────────────────┘
        │
        │ reads from
        ▼
┌─────────────────┐
│    Users DB     │
│    (replica)    │
└─────────────────┘
```

## Setup

```bash
pnpm install
docker-compose up -d   # Redis Stack with Bloom filter support
```

Redis Insight UI: http://localhost:8001

## Demos

| Command | Description |
|---------|-------------|
| `pnpm demo:single` | Single notification through the full pipeline |
| `pnpm demo:bulk` | Bulk campaign with iterator pattern |
| `pnpm demo:priority` | P1 notifications bypass P3 congestion |
| `pnpm demo:dedup` | Bloom filter prevents duplicates on restart |
| `pnpm demo:all` | Complete walkthrough |

### Running Workers Separately

```bash
pnpm worker:p1    # High priority
pnpm worker:p2    # Medium priority
pnpm worker:p3    # Low priority
pnpm worker:all   # All workers together
```

## Cleanup

```bash
docker-compose down -v
```
