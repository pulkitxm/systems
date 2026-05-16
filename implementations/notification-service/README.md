# Notification Service

TypeScript implementation of a scalable notification service with priority queues, bulk processing, and Bloom filter deduplication.

Every application needs to notify users. Order confirmations. Appointment reminders. Marketing campaigns. The mechanics seem simple: send a message to a user. But at scale, this becomes a genuinely interesting engineering problem.

What happens when you need to notify a million users about a flash sale? How do you ensure an appointment reminder isn't delayed behind 50 million marketing messages? How do you avoid sending the same notification twice when your iterator crashes and restarts?

## TL;DR

- **Notification templates** store reusable message formats with variables (like `{{user.name}}`) in a meta database
- **Control service** handles template management and initial request processing, but doesn't send notifications directly
- **Asynchronous processing** with message queues decouples request handling from notification emission
- **Workers are stateless and dumb**: they receive fully-formed messages and just send them via provider SDKs (Twilio, Resend, OneSignal)
- **Bulk notifications** use a separate iterator service that reads from the users database and enqueues individual messages
- **Priority queues** (P1, P2, P3) prevent marketing campaigns from starving transactional notifications
- **Deduplication** uses Bloom filters in Redis to prevent sending the same notification twice after iterator restarts
- **Horizontal scaling** is achieved at every layer: queues, stateless workers, sharded tracking database, user database replicas

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

---

## Notification Templates

Before sending any notification, you need to define what the notification says. But notifications aren't static. They contain personalized data: usernames, order numbers, discount percentages.

A template looks like:

```
Hello {{user.name}},

Your order from {{restaurant.name}} will arrive in {{eta}} minutes.
Get {{discount}}% off your next order!
```

The template is stored once. When sending, you inject the actual values. This separation of structure and content is fundamental.

### Template Storage

Templates live in a **notification meta database**. This database is small. Even if you have ten thousand different notification types, each template might be 500 bytes. That's under 5 MB total. A single relational database handles this easily.

```typescript
interface NotificationTemplate {
  id: string;
  channel: "email" | "sms" | "push_android" | "push_ios";
  subject?: string;
  body: string;
  variables: string[];
}

async function createTemplate(
  template: Omit<NotificationTemplate, "id">
): Promise<NotificationTemplate> {
  const id = generateId();
  await db.template.create({
    data: { id, ...template },
  });
  return { id, ...template };
}
```

## Notification Channels

Users can be notified through multiple channels:

- **Email**: Providers like Resend, SES, SendGrid
- **SMS**: Twilio, Message91
- **Android Push**: Firebase Cloud Messaging, OneSignal
- **iOS Push**: Apple Push Notification Service, OneSignal

Each channel has providers that expose APIs. You don't build email infrastructure from scratch. You integrate Resend's SDK, pass the email address and body, and they handle delivery.

The key insight: these API calls are expensive network operations. The servers making these calls need high network bandwidth. One machine cannot make millions of concurrent network calls. This shapes our architecture.

## Day Zero Flow

Let's start with the simplest possible flow: one user, one notification.

1. PM calls the control service: "Send notification N1 to user U1 with these variables"
2. Control service fetches template N1 from meta database
3. Control service populates the template with user-specific values
4. Control service calls Twilio/Resend/OneSignal to send the notification
5. User receives the notification

```typescript
async function sendNotification(request: {
  userId: string;
  templateId: string;
  variables: Record<string, string>;
  channel: string;
}): Promise<void> {
  const template = await db.template.findUnique({
    where: { id: request.templateId },
  });

  const body = populateTemplate(template.body, request.variables);

  switch (request.channel) {
    case "email":
      await resend.emails.send({ to: user.email, html: body });
      break;
    case "sms":
      await twilio.send({ to: user.phone, body });
      break;
  }
}
```

This works for one user. But what happens when you need to notify thousands?

## The Bottleneck

Two problems emerge immediately:

1. **Triggering one notification per user is painful.** A PM isn't going to make 100,000 API calls manually
2. **The control service becomes a bottleneck.** Network calls to providers take time. Provider outages cause retries. The control service gets overwhelmed

The control service should control things, not do heavy lifting. Making synchronous calls to external providers is the wrong responsibility for this component.

## Making It Asynchronous

The classic solution: introduce a message queue between the control service and the notification-sending logic.

When a notification request arrives, the control service:

1. Fetches the template from meta database
2. Populates it with user data
3. Creates a complete notification message
4. Pushes the message to a queue
5. Returns immediately

Workers consume messages from the queue and send actual notifications. The message contains everything a worker needs: user contact info, final notification body, channel. Workers are dumb. They don't need database connections. They just pick up a message and emit the notification.

```typescript
interface NotificationMessage {
  userId: string;
  channel: "email" | "sms" | "push_android" | "push_ios";
  body: string;
  subject?: string;
  contactInfo: string;
}

async function handleNotificationRequest(request: NotificationRequest) {
  const template = await db.template.findUnique({
    where: { id: request.templateId },
  });

  const body = populateTemplate(template.body, request.variables);
  const user = await db.user.findUnique({ where: { id: request.userId } });

  const message: NotificationMessage = {
    userId: request.userId,
    channel: request.channel,
    body,
    contactInfo: getContactInfo(user, request.channel),
  };

  await sqs.sendMessage({
    QueueUrl: NOTIFICATION_QUEUE_URL,
    MessageBody: JSON.stringify(message),
  });
}
```

Workers are simple:

```typescript
async function worker(): Promise<void> {
  while (true) {
    const response = await sqs.receiveMessage({
      QueueUrl: NOTIFICATION_QUEUE_URL,
      MaxNumberOfMessages: 10,
      WaitTimeSeconds: 20,
    });

    for (const msg of response.Messages ?? []) {
      const notification: NotificationMessage = JSON.parse(msg.Body ?? "{}");

      await sendViaProvider(notification);

      await sqs.deleteMessage({
        QueueUrl: NOTIFICATION_QUEUE_URL,
        ReceiptHandle: msg.ReceiptHandle,
      });
    }
  }
}

async function sendViaProvider(notification: NotificationMessage) {
  switch (notification.channel) {
    case "email":
      await resend.emails.send({
        to: notification.contactInfo,
        html: notification.body,
      });
      break;
    case "sms":
      await twilio.send({
        to: notification.contactInfo,
        body: notification.body,
      });
      break;
  }
}
```

### Why This Architecture Wins

**Retries are automatic.** If Twilio is down, the worker fails to send. The message isn't deleted. After the visibility timeout, it reappears in the queue. Another worker picks it up and retries. The control service doesn't manage retries. The queue does.

**The control service stays responsive.** It accepts requests, creates messages, and returns. No waiting for provider responses. No getting hogged by retries.

**Workers are stateless.** Any worker can process any message. Scale horizontally by adding more workers.

## Bulk Notifications

The architecture above works for moderate traffic where notifications are triggered one at a time. But consider the use case: "Notify everyone."

A PM submits a job: send this marketing notification to all users. If you have a million users, someone needs to iterate through the users table and create a million notification messages. Who does this?

**Not the control service.** If the control service iterates over a million users, it's blocked from accepting other requests. It becomes unavailable for transactional notifications that need immediate processing.

The solution: **separate the iteration logic into its own service**.

### Iterator Architecture

Introduce a second queue for bulk notification requests. When a PM triggers a bulk notification:

1. Control service creates a bulk job message with the template ID and filter criteria
2. This message goes to the **bulk queue**, not the main notification queue
3. Iterator workers consume from the bulk queue
4. For each matching user, the iterator creates a notification message and enqueues it in the main notification queue
5. Regular notification workers process these messages and send notifications

```typescript
interface BulkNotificationJob {
  templateId: string;
  filters: {
    city?: string;
    ageRange?: [number, number];
    lastLoginBefore?: Date;
    platform?: "android" | "ios";
  };
  channel: string;
  variables: Record<string, string>;
}

async function processBulkJob(job: BulkNotificationJob) {
  const template = await metaDb.template.findUnique({
    where: { id: job.templateId },
  });

  const users = await usersDb.user.findMany({
    where: buildWhereClause(job.filters),
  });

  for (const user of users) {
    const body = populateTemplate(template.body, {
      ...job.variables,
      "user.name": user.name,
    });

    const message: NotificationMessage = {
      userId: user.id,
      channel: job.channel,
      body,
      contactInfo: getContactInfo(user, job.channel),
    };

    await sqs.sendMessage({
      QueueUrl: NOTIFICATION_QUEUE_URL,
      MessageBody: JSON.stringify(message),
    });
  }
}
```

### Users Database Isolation

The iterator reads from the users table intensively. To avoid affecting production traffic on your main users database, use a **read replica**. The iterator queries the replica, not the primary. Your actual user-facing operations remain unaffected.

## The Starvation Problem

Here's a scenario that breaks our current design.

A PM launches a massive marketing campaign. A million notifications are enqueued. The workers start processing them. Meanwhile, a user completes a payment and needs a transaction confirmation. That confirmation message goes to the same queue, behind a million marketing messages.

When does the user receive their transaction confirmation? After all the marketing messages are processed. That could be hours.

This is **starvation**. Low-priority notifications are blocking high-priority ones.

### Priority Queues

The solution: multiple queues with different priorities.

| Priority    | Use Case      | Examples                                           |
| ----------- | ------------- | -------------------------------------------------- |
| P1 (High)   | Transactional | Payment confirmations, OTPs, appointment reminders |
| P2 (Medium) | Default       | Order updates, account notifications               |
| P3 (Low)    | Marketing     | Campaigns, promotions, newsletters                 |

Each priority level has its own queue and its own set of workers.

```typescript
type Priority = "P1" | "P2" | "P3";

const QUEUE_URLS: Record<Priority, string> = {
  P1: process.env.SQS_P1_URL!,
  P2: process.env.SQS_P2_URL!,
  P3: process.env.SQS_P3_URL!,
};

async function enqueueNotification(
  message: NotificationMessage,
  priority: Priority
) {
  await sqs.sendMessage({
    QueueUrl: QUEUE_URLS[priority],
    MessageBody: JSON.stringify(message),
  });
}
```

When triggering a notification, you specify the priority:

```typescript
await controlService.sendNotification({
  templateId: "payment_confirmation",
  userId: "user_123",
  variables: { amount: "$50.00" },
  channel: "email",
  priority: "P1",
});
```

P1 workers are never blocked by P3 messages. Your payment confirmations go out immediately, even during a massive marketing campaign.

You can also tune worker counts per priority. Maybe you run more P3 workers during off-peak hours when marketing campaigns typically execute, and scale them down during peak transaction times.

In this implementation, we use BullMQ with different concurrency settings:

```typescript
const CONCURRENCY = {
  P1: 10, // High priority - process fast
  P2: 5, // Medium priority
  P3: 3, // Low priority - don't overwhelm providers
};
```

## The Deduplication Problem

Another failure mode. The iterator is processing a million users. It's enqueued 500,000 messages. Then it crashes.

When the iterator restarts, it starts from the beginning. It iterates through all users again. Those 500,000 users who already received the notification? They're about to receive it again.

Duplicate marketing notifications are a bad user experience. Users complain. They unsubscribe. They mark you as spam.

### Tracking Sent Notifications

We need to track which users have already received a notification from a specific campaign. Before enqueuing a message, check if it was already sent.

A naive approach: store `(user_id, campaign_id)` pairs in a database.

```typescript
async function shouldSendNotification(
  userId: string,
  campaignId: string
): Promise<boolean> {
  const existing = await redis.get(`sent:${campaignId}:${userId}`);
  return !existing;
}

async function markAsSent(userId: string, campaignId: string): Promise<void> {
  await redis.set(`sent:${campaignId}:${userId}`, "1", "EX", 86400 * 7);
}
```

Let's compute the storage. User ID: 4 bytes. Campaign ID: 4 bytes. Total: 8 bytes per entry.

With 100 million users and 5 concurrent marketing campaigns: 100M × 5 × 8 bytes = 4 GB.

That's manageable, but we can do better.

### Bloom Filters for Deduplication

For marketing notifications, we don't need 100% accuracy. If we occasionally skip sending to a user who hasn't received the notification, it's acceptable. Marketing has some tolerance for imprecision.

Bloom filters are perfect here. They're probabilistic data structures that tell you with 100% certainty when something doesn't exist, but can have false positives when saying something exists.

**When the Bloom filter says "no"**: The user definitely hasn't received this notification. Send it.

**When the Bloom filter says "yes"**: The user might have received this notification. Skip it to be safe.

False positives mean some users don't receive the marketing notification. That's acceptable. False negatives (sending duplicates) don't happen with Bloom filters.

Redis Stack supports Bloom filters natively:

```typescript
async function shouldSendNotification(
  userId: string,
  campaignId: string
): Promise<boolean> {
  const exists = await redis.call("BF.EXISTS", `campaign:${campaignId}`, userId);
  return exists === 0;
}

async function markAsSent(userId: string, campaignId: string): Promise<void> {
  await redis.call("BF.ADD", `campaign:${campaignId}`, userId);
}
```

The storage savings are significant. A Bloom filter for 100 million users with 1% false positive rate requires about 114 MB. Compare that to 4 GB for explicit storage. That's a 35x reduction.

### Where to Deduplicate

You could deduplicate at the worker level: worker receives message, checks Bloom filter, skips if already sent. But this means you've already enqueued the message, transmitted it over the network, and a worker has consumed it.

Better: deduplicate at the iterator level. Before enqueuing a message, the iterator checks the Bloom filter. If the notification was already sent, it doesn't enqueue. This saves queue capacity, worker time, and network bandwidth.

```typescript
async function processBulkJob(job: BulkNotificationJob) {
  const template = await metaDb.template.findUnique({
    where: { id: job.templateId },
  });

  const users = await usersDb.user.findMany({
    where: buildWhereClause(job.filters),
  });

  for (const user of users) {
    const shouldSend = await shouldSendNotification(user.id, job.campaignId);
    if (!shouldSend) {
      continue;
    }

    const body = populateTemplate(template.body, {
      ...job.variables,
      "user.name": user.name,
    });

    const message: NotificationMessage = {
      userId: user.id,
      channel: job.channel,
      body,
      contactInfo: getContactInfo(user, job.channel),
      campaignId: job.campaignId,
    };

    await sqs.sendMessage({
      QueueUrl: QUEUE_URLS[job.priority],
      MessageBody: JSON.stringify(message),
    });

    await markAsSent(user.id, job.campaignId);
  }
}
```

Note: for transactional notifications (P1), duplicates are generally acceptable. Getting two "payment successful" notifications is fine. The deduplication logic is primarily for marketing campaigns.

## Final Architecture

Putting it all together:

**Control Service**: Accepts notification requests from internal services and PMs. For single-user notifications, fetches the template, populates it, and enqueues directly. For bulk notifications, creates a bulk job and enqueues to the bulk queue.

**Meta Database**: Stores notification templates. Small, single relational database. Read-heavy, rarely written.

**Bulk Queue**: Holds bulk notification jobs with filter criteria.

**Iterator Workers**: Consume bulk jobs. Iterate over users database (using a replica). For each matching user, check Bloom filter, create notification message, enqueue to the appropriate priority queue, update Bloom filter.

**Priority Queues (P1, P2, P3)**: Three queues for different priorities. P1 for transactional, P2 for default, P3 for marketing.

**Notification Workers**: Consume from priority queues. Send notifications via provider SDKs (Twilio, Resend, OneSignal). Stateless. Scale horizontally.

**Notification Tracker (Redis)**: Bloom filters keyed by campaign ID. Used for deduplication of marketing notifications.

**Users Database Replica**: Read replica of main users database. Iterator reads from this to avoid affecting production traffic.

## Design Principles

**Start simple, evolve incrementally.** We started with synchronous single-user notifications, identified bottlenecks, and added complexity only where needed.

**Separate concerns.** The control service manages templates and requests. Iterators handle bulk expansion. Workers handle emission. Each component has one job.

**Make workers dumb.** Workers receive complete messages. No database calls, no business logic. They just send. This makes them stateless and trivially scalable.

**Use queues for decoupling.** Queues absorb load spikes, enable retries, and let producers and consumers operate independently.

**Trade accuracy for efficiency where acceptable.** Bloom filters trade some marketing accuracy for massive storage savings. For marketing notifications, this trade-off makes sense.

**Protect critical paths from bulk operations.** Priority queues ensure transactional notifications aren't blocked by marketing campaigns.

## Scaling Properties

| Component            | Scaling Approach                                   |
| -------------------- | -------------------------------------------------- |
| Control Service      | Stateless, add more instances behind load balancer |
| Meta Database        | Read replicas (write traffic is minimal)           |
| Iterator Workers     | Add more workers to process bulk jobs faster       |
| Priority Queues      | SQS is managed, scales automatically               |
| Notification Workers | Add workers per priority queue as needed           |
| Notification Tracker | Shard Redis by campaign ID                         |
| Users Replica        | Add replicas for read throughput                   |

---

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

## Provider Integration

Mock providers simulate real behavior:

```typescript
async function sendEmail(to: string, subject: string, body: string) {
  const latency = await simulateLatency(); // 50-200ms
  if (simulateFailure(0.05)) {
    // 5% failure rate
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

## Cleanup

```bash
docker-compose down -v
```

## Related

- [Bloom Filters](https://pulkitxm.com/series/system-design/bloom-filters) — probabilistic set membership
- [Async Processing](https://pulkitxm.com/series/system-design/async-processing) — queues and workers
