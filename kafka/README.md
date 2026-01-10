# Kafka Message Streams Exercise

A simple TypeScript implementation demonstrating Apache Kafka message streams with producers and multiple consumer groups.

## 📚 Key Concepts

### Message Streams vs Message Queues

**Message Queues (RabbitMQ, SQS):**
- One message → consumed by ONE consumer
- Message is deleted after consumption
- All consumers do the same thing

**Message Streams (Kafka, Kinesis):**
- One message → consumed by MULTIPLE consumer groups
- Messages persist (not deleted immediately)
- Different consumer groups can do different things
- Each consumer group processes at its own pace

### Kafka Essentials

1. **Topics**: Named channels for messages (e.g., `blog-published`)

2. **Partitions**: Topics are split into partitions for parallelism
   - Messages with same partition key go to same partition
   - Enables ordered processing per key

3. **Consumer Groups**: Different types of consumers
   - Each group processes ALL messages independently
   - Within a group, each partition is consumed by ONE consumer
   - Max consumers per group = number of partitions

4. **Commits**: Consumers track their progress
   - No message deletion
   - Consumers "commit" their position
   - Can resume from last committed offset

5. **Retention Policy**: Messages auto-delete after configured time (e.g., 14 days)

## 🏗️ Architecture

```
Producer (API Server)
    ↓
    └─→ Kafka Topic: blog-published
            ├─→ Partition 0
            ├─→ Partition 1  
            └─→ Partition 2
                    ↓
        ┌───────────┴───────────┐
        ↓                       ↓
Search Consumer Group    Counter Consumer Group
(indexes blogs)          (counts posts per user)
```

### Why This Solves the Problem

❌ **Problem with Multiple Queues**: API server writes to 2 queues → if it crashes after writing to one, data becomes inconsistent

✅ **Solution with Kafka**: API server writes to ONE topic → multiple consumer groups read the same message independently

## 🚀 How to Run

### 1. Start Kafka & UI

```bash
docker-compose up -d
```

Wait ~30 seconds for Kafka to be ready.

**Open Kafka UI**: http://localhost:8080

The UI lets you:
- 📊 View topics and partitions
- 📨 See messages in real-time
- 👥 Monitor consumer groups and their lag
- 🔍 Browse message contents

### 2. Install Dependencies

```bash
pnpm install
# or
npm install
```

### 3. Start Consumers (in separate terminals)

**Terminal 1 - Search Consumer:**
```bash
pnpm run search-consumer
```

**Terminal 2 - Counter Consumer:**
```bash
pnpm run counter-consumer
```

### 4. Publish Messages

**Terminal 3 - Producer:**
```bash
pnpm run producer
```

## 🔍 What to Observe

### In the Terminal:
1. **Single Write, Multiple Reads**: Producer writes once, both consumers receive the same messages

2. **Independent Processing**: Each consumer group processes at its own speed
   - Search consumer takes ~500ms per message
   - Counter consumer takes ~300ms per message

3. **Partition Key**: Messages from same `userId` go to same partition

4. **Consumer Groups**: Two different groups (`search-indexer-group` and `post-counter-group`) process independently

5. **Resumability**: Stop and restart a consumer - it resumes from where it left off

### In the Kafka UI (http://localhost:8080):
1. **Topics Tab**: See `blog-published` topic with its partitions
2. **Messages Tab**: Browse all messages, see which partition they're in
3. **Consumers Tab**: Monitor both consumer groups:
   - `search-indexer-group`
   - `post-counter-group`
   - See their lag (how many messages behind they are)
4. **Live Updates**: Watch messages appear in real-time as you run the producer

## 🧪 Experiments to Try

### Experiment 1: Multiple Consumers in Same Group
Start 2 search consumers in different terminals:
```bash
# Terminal 1
pnpm run search-consumer

# Terminal 2  
pnpm run search-consumer
```
**Observe**: Messages are split between them (each partition assigned to one consumer)

### Experiment 2: Consumer Failure & Recovery
1. Start both consumers
2. Run producer
3. Stop a consumer mid-processing (Ctrl+C)
4. Restart it
**Observe**: It resumes from last committed offset

### Experiment 3: Different Processing Speeds
Check the logs - notice how:
- Search consumer is slower (500ms)
- Counter consumer is faster (300ms)
- They process independently without blocking each other

### Experiment 4: Partition Distribution
Look at the logs to see which partition each message goes to:
- Same `userId` always goes to same partition
- This ensures ordering per user

## 🛑 Cleanup

```bash
docker-compose down -v
```

## 📖 Key Takeaways

1. **Write Once, Read Many**: Kafka enables multiple consumers to process the same event
2. **Decoupling**: Consumers don't know about each other
3. **Scalability**: Add more partitions → more parallel consumers
4. **Reliability**: Messages persist, consumers can fail and recover
5. **Flexibility**: Add new consumer groups anytime without affecting existing ones
