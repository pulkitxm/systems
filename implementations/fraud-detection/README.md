# Fraud Detection System Design

> **Motive:** Understand where **big data** fits — Spark ETL joins massive CS + transaction DBs into S3; Spark MLlib trains models at scale; a lightweight **fraud detection service** serves predictions in **<200ms**.

When you transfer money, the bank registers the transaction, **synchronously** checks fraud, then either completes it or holds it for customer support to call you (the Grammarly international payment story).

---

## TL;DR

- **Transaction DB:** `source_acc`, `target_acc`, `amount`, `status`, meta (`ip`, `region`, `location`, `target_bank`, …)
- **Status lifecycle:** `INITIATED → BLOCKED/FRAUD/ALLOWED → DONE/FAILED`
- **Fraud service:** HTTP-style sync call, **<200ms SLA**, Random Forest in memory
- **Algorithm:** Decision trees (entropy splits) + **majority vote** across trees
- **Training data:** Customer support tickets label fraud (`is_fraud`) — joined with transaction meta
- **Big data:** Spark ETL → S3 JSON shards → Spark MLlib → model on S3 → load on service boot

---

## Problem Statement

| Step | Behavior |
|------|----------|
| User initiates transfer | Bank API registers txn as `INITIATED` |
| Fraud check | Sync call to fraud detection service |
| Not fraud | Status → `ALLOWED` → `DONE` |
| Fraud | Hold txn, notify CS, executive calls user |
| User says YES | Allow transaction |
| User says NO | Abort (`FAILED`) |

Shard key: `source_acc` (relational DB, no FK constraints for scale).

---

## Architecture

```
User ──▶ Bank API (Txn Handler) ──▶ Transaction DB
              │
              │ sync <200ms
              ▼
        Fraud Detection Service
        (Random Forest in RAM)
              │
     ┌────────┴────────┐
     FRAUD            LEGIT
     │                  │
  Notify CS          DONE
  User YES/NO

Training (offline):
  CS DB ──┐
          ├──▶ Spark ETL ──▶ S3/training/*.json
  Txn DB ─┘                      │
                                 ▼
                          Spark + MLlib
                                 │
                                 ▼
                          S3/models/random-forest.json
                                 │
                                 ▼
                    Load on fraud service boot
```

---

## Deep Dive: Storage

```sql
-- transactions (shard by source_acc in production)
txn_id, source_acc, target_acc, amount, status,
ip, region, location, target_bank, is_international, hour_of_day, created_at

-- tickets (training labels from CS portal)
ticket_id, txn_id, is_fraud, summary, resolved_at
```

Statuses: `INITIATED | BLOCKED | FRAUD | ALLOWED | DONE | FAILED`

---

## Deep Dive: Bank API Flow

```typescript
// src/bank-api/transaction-handler.ts
1. insertTransaction(req, "INITIATED")
2. classifyTransaction(txn)  // sync fraud service
3. if fraud → BLOCKED/FRAUD + notifyCustomerSupport()
   else → ALLOWED → DONE
```

Metadata from HTTP request: IP, region, location, target bank, international flag, hour of day.

---

## Deep Dive: Random Forest

Each tree uses a **different feature subset** (matches slides):

| Tree | Features |
|------|----------|
| tree_1 | location + hour_of_day |
| tree_2 | region + target_bank |
| tree_3 | hour + amount + bank |
| tree_4 | amount + is_international |
| tree_5 | region + hour + international |

**Classification:** run txn through all trees → **majority vote** → FRAUD or LEGIT.

```bash
pnpm demo:tree     # single decision tree + entropy splits
pnpm demo:forest   # full forest + votes
```

Decision trees built from scratch using **information gain** (entropy).

---

## Deep Dive: Big Data Pipeline (Simulated Spark)

### Job 1 — ETL

- Read transaction DB + customer support DB
- Join on `txn_id`
- Enrich with feature vector + fraud label
- Write **multiple JSON shards** to `data/s3/training/` (not one giant file)

### Job 2 — Train (MLlib)

- Read all shards from S3
- Train Random Forest
- Serialize trees to `data/s3/models/random-forest.json`

```bash
pnpm seed
pnpm demo:pipeline
```

### Job 3 — Serve

On boot, fraud detection servers load model from S3 into memory. No reprocessing of training data at request time.

---

## Deep Dive: 200ms SLA

In-memory tree traversal is microseconds. Production concern is network + model size — keep trees shallow, warm cache on boot.

```typescript
// src/config.ts
export const FRAUD_SLA_MS = 200;
```

---

## File Structure

```
fraud-detection/
├── src/
│   ├── db/                 # Transaction + CS SQLite
│   ├── bank-api/           # Transaction handler
│   ├── ml/                 # Decision tree, Random Forest, features
│   ├── pipeline/           # ETL + train jobs
│   ├── service/            # Fraud detection service
│   ├── fixtures/           # Seed + live txns
│   ├── scripts/            # init, seed
│   └── demos/              # tree, forest, pipeline, realtime, all
└── README.md
```

---

## Quick Start

```bash
cd implementations/fraud-detection
pnpm install
pnpm init
pnpm seed
pnpm demo:all
```

Individual demos:

```bash
pnpm demo:tree       # decision tree structure
pnpm demo:forest     # random forest majority vote
pnpm demo:pipeline   # Spark ETL + MLlib train
pnpm demo:realtime   # live txn → allow/block
```

---

## Mapping to Production

| Demo | Production |
|------|------------|
| SQLite txn DB | Sharded PostgreSQL / Cassandra |
| SQLite CS DB | CS ticketing system |
| Local `data/s3/` | AWS S3 |
| `runEtlJob()` | PySpark job reading DBs |
| `runTrainJob()` | Spark MLlib RandomForestClassifier |
| `classifyTransaction()` | Fraud service behind load balancer |
| TypeScript trees | Often Python sklearn → exported model |

---

## Exercises

1. Add a new feature (`user_tenure_days`) in `feature-extractor.ts` and retrain.
2. Change tree 4 to use only `amount` — observe vote shifts on live txns.
3. Simulate CS confirmation: call `confirmFraudTransaction(txnId, true)` after a FRAUD hold.
4. Measure p99 latency with 10,000 classifications in a loop.
5. Port ETL to **PySpark** writing JSON shards to a local folder (as suggested in the lecture).

---

## References

- Apache Spark / MLlib — distributed ETL and ML
- Random Forest / Decision Trees — ensemble classification
- Arpit Bhayani — *Designing Fraud Detection*
