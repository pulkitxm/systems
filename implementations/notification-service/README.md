# Notification Service

TypeScript implementation of a scalable notification service with priority queues, bulk processing, and Bloom filter deduplication.

Companion code for the blog post: [Designing and Scaling Notifications](https://pulkitxm.com/series/system-design/notification-service)

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

## Components

| Component | Description |
|-----------|-------------|
| **Control Service** | Accepts notification requests, fetches templates, enqueues messages |
| **Template Store** | Reusable notification templates with variable interpolation |
| **Priority Queues** | P1 (transactional), P2 (default), P3 (marketing) - prevents starvation |
| **Notification Workers** | Consume from queues, send via provider SDKs (Resend, Twilio, etc.) |
| **Iterator Workers** | Expand bulk jobs into individual notifications |
| **Bloom Filter** | Track sent notifications to prevent duplicates on iterator restart |

## Setup

```bash
pnpm install
```

Start Redis with Bloom filter support:

```bash
docker-compose up -d
```

Redis Insight UI: http://localhost:8001

## Demos

### Single Notification

Send a notification to one user through the full pipeline:

```bash
pnpm demo:single
```

- Creates an order confirmation template
- Sends notification via control service
- Worker processes and "sends" via Resend

### Bulk Notification

Send to multiple users with iterator pattern:

```bash
pnpm demo:bulk
```

- Creates a marketing template
- Submits bulk job to iterator queue
- Iterator reads users, enqueues individual notifications
- Workers process each notification

### Priority Queues

Demonstrate how P1 notifications bypass P3 queue congestion:

```bash
pnpm demo:priority
```

- Starts a bulk marketing campaign (P3)
- Sends a payment confirmation (P1) during the campaign
- Observes P1 processed immediately while P3 continues in background

### Deduplication

Show Bloom filter preventing duplicates on iterator restart:

```bash
pnpm demo:dedup
```

- Runs a campaign, processes some users
- Simulates iterator crash and restart
- Second run skips already-sent users (checked via Bloom filter)
- Demonstrates false positive rate

### Complete Flow

Full walkthrough of all features:

```bash
pnpm demo:all
```

## Running Workers Separately

For production-like testing, run workers in separate terminals:

```bash
# Terminal 1 - P1 worker (high priority)
pnpm worker:p1

# Terminal 2 - P2 worker (medium priority)
pnpm worker:p2

# Terminal 3 - P3 worker (low priority)
pnpm worker:p3

# Or all workers together
pnpm worker:all
```

## Implementation Deep Dive

### Template System

Templates use Mustache-style variables:

```typescript
const template = await createTemplate(
  "email",
  "Order Confirmed - #{{orderNumber}}",
  `Hi {{user.name}},
   Your order #{{orderNumber}} is confirmed.
   Total: {{total}}`,
  ["user.name", "orderNumber", "total"]
);
```

Variables are interpolated at send time:

```typescript
const body = populateTemplate(template.body, {
  "user.name": "Alice",
  orderNumber: "ORD-123",
  total: "$99.99",
});
```

### Priority Queue System

Three separate BullMQ queues with different concurrency:

```typescript
const CONCURRENCY = {
  P1: 10,  // High priority - process fast
  P2: 5,   // Medium priority
  P3: 3,   // Low priority - don't overwhelm providers
};
```

This ensures transactional notifications (OTPs, payment confirmations) are never blocked by marketing campaigns.

### Bulk Notification Flow

1. Control service receives bulk request
2. Creates `BulkNotificationJob` with template ID and filters
3. Enqueues to `notifications:bulk` queue
4. Iterator worker consumes job:
   - Reads users from replica database
   - For each user:
     - Check Bloom filter (skip if already sent)
     - Populate template
     - Enqueue to priority queue
     - Mark as sent in Bloom filter
5. Notification workers send via providers

### Bloom Filter Deduplication

Redis Stack's native Bloom filter:

```typescript
// Initialize with expected capacity and error rate
await redis.call("BF.RESERVE", `bloom:campaign:${id}`, 0.01, 1_000_000);

// Check before sending
const wasSent = await redis.call("BF.EXISTS", key, userId);
if (wasSent) continue; // Skip duplicate

// Mark after enqueueing
await redis.call("BF.ADD", key, userId);
```

**Why Bloom filters for marketing?**

- False positive (skip user who wasn't sent): acceptable for marketing
- False negative (send duplicate): impossible with Bloom filters
- Memory: ~114 MB for 100M users at 1% FP rate vs 4 GB explicit storage

### Provider Integration

Mock providers simulate real behavior:

```typescript
async function sendEmail(to: string, subject: string, body: string) {
  const latency = await simulateLatency(); // 50-200ms
  if (simulateFailure(0.05)) {             // 5% failure rate
    throw new Error("Provider error");
  }
  return { success: true, provider: "resend", messageId: "..." };
}
```

Replace with real SDKs:

```typescript
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

async function sendEmail(to: string, subject: string, body: string) {
  const result = await resend.emails.send({
    from: "notifications@yourapp.com",
    to,
    subject,
    html: body,
  });
  return result;
}
```

## File Structure

```
src/
├── connection.ts          # Redis connection, shared types
├── template.ts            # Template CRUD and interpolation
├── queue.ts               # BullMQ queue setup (P1, P2, P3, bulk)
├── providers.ts           # Mock notification providers
├── users.ts               # Mock users database
├── worker.ts              # Notification workers
├── iterator.ts            # Bulk job expansion
├── bloom-filter.ts        # Deduplication logic
├── control-service.ts     # Entry point for sending notifications
├── utils.ts               # Helpers
├── run-worker.ts          # CLI to run workers
├── demo-single.ts         # Single notification demo
├── demo-bulk.ts           # Bulk notification demo
├── demo-priority.ts       # Priority queue demo
├── demo-dedup.ts          # Bloom filter demo
└── demo-all.ts            # Complete walkthrough
```

## Key Concepts Demonstrated

### 1. Asynchronous Processing

The control service never calls providers directly. It enqueues messages and returns immediately:

```typescript
// Control service (fast)
await sqs.sendMessage({ QueueUrl, MessageBody: JSON.stringify(message) });
return { success: true, jobId };

// Worker (slow, handles retries)
const result = await resend.emails.send({ to, subject, html: body });
```

### 2. Workers Are Dumb

Workers receive complete messages with all data needed. No database calls, no business logic:

```typescript
interface NotificationMessage {
  userId: string;
  channel: "email" | "sms" | "push_android" | "push_ios";
  body: string;           // Already populated
  subject?: string;       // Already populated
  contactInfo: string;    // Already resolved
}
```

### 3. Isolation of Bulk Operations

Bulk jobs go to a separate queue processed by iterator workers. This prevents:

- Control service getting blocked on large iterations
- Main notification queues getting flooded
- Production traffic being affected

### 4. Database Replica for Reads

Iterator reads from a replica, not the primary:

```typescript
async function getUsersFromReplica(filters) {
  console.log("Reading from users database replica...");
  // Query replica, not primary
  return users;
}
```

### 5. Automatic Retries via Queue

BullMQ handles retries with exponential backoff:

```typescript
await queue.add("send", message, {
  attempts: 3,
  backoff: {
    type: "exponential",
    delay: 1000,  // 1s, 2s, 4s
  },
});
```

## Scaling Properties

| Component | Scaling Approach |
|-----------|-----------------|
| Control Service | Stateless, add instances behind load balancer |
| Priority Queues | Managed (SQS) or Redis Cluster |
| Notification Workers | Add workers per queue as needed |
| Iterator Workers | Add to process bulk jobs faster |
| Bloom Filter | Shard by campaign ID |
| Users Replica | Add read replicas for throughput |

## Cleanup

```bash
docker-compose down -v
```

## Related

- Blog post: [Designing and Scaling Notifications](https://pulkitxm.com/series/system-design/notification-service)
- [Bloom Filters](https://pulkitxm.com/series/system-design/bloom-filters) - Deep dive into probabilistic data structures
- [Async Processing](https://pulkitxm.com/series/system-design/async-processing) - Message queues and workers
