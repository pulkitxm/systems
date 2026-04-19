# E-Commerce Product Listing

A small shop owner's product catalog - 100 items, read-heavy traffic, PostgreSQL with streaming replication.

## Architecture

```
  ┌──────────┐         ┌──────────┐
  │ Admin UI │         │ Customer │
  │(shop owner)        │ Frontend │
  └────┬─────┘         └────┬─────┘
       │  CRUD               │  GET
       └──────────┬──────────┘
                  ▼
        ┌──────────────────┐
        │ Catalog Backend  │
        │   (port 3000)    │
        └────────┬─────────┘
                 │
       ┌─────────┴─────────┐
       │                   │
  WRITES + READS        READS only
       │                   │
       ▼                   ▼
  ┌──────────┐       ┌──────────┐
  │  MASTER  │──WAL─▶│ REPLICA  │
  │ (5432)   │       │ (5433)   │
  └──────────┘       └──────────┘
```

**Key design decision:** Master handles both reads AND writes. There's no rule that master only handles writes. Since writes are very infrequent (only shop owner adding/updating products), master has plenty of capacity for customer reads too. Reads are randomly distributed 50/50 between master and replica.

## DB Schema

```sql
products (
  id          SERIAL PRIMARY KEY,
  title       VARCHAR(200),
  description TEXT,
  price       NUMERIC(10,2),
  color       VARCHAR(50),
  category    VARCHAR(100),
  image_url   TEXT,
  stock       INT,
  created_at  TIMESTAMPTZ,
  updated_at  TIMESTAMPTZ
)
```

~100 rows × ~1 KB each = ~100 KB total. Fits easily in a single node.

## Setup

```bash
# 1. Start master + replica (streaming replication via WAL)
docker compose up -d

# 2. Wait ~10s for replica to sync, then install deps
pnpm install

# 3. Create the products table on master (auto-replicates)
node src/init-db.js

# 4. Seed 100 random products
node src/seed.js

# 5. Start the catalog backend
node src/server.js
```

## API Endpoints

### Admin (shop owner) - writes to MASTER

| Method | Path                | Body |
|--------|---------------------|------|
| POST   | /admin/products     | `{ title, description, price, color, category, image_url, stock }` |
| PUT    | /admin/products/:id | any fields to update |
| DELETE | /admin/products/:id | - |

### Customer (catalog) - reads from MASTER or REPLICA (random)

| Method | Path          | Query params |
|--------|---------------|--------------|
| GET    | /products     | `?category=`, `?color=`, `?sort=price_asc\|price_desc` |
| GET    | /products/:id | - |

### Utility

| Method | Path          | Description |
|--------|---------------|-------------|
| GET    | /health       | Check both DB connections |
| GET    | /replication  | Streaming replication status |

## Try it

```bash
# List all products (watch logs - randomly hits master or replica)
curl http://localhost:3000/products

# Filter by category
curl "http://localhost:3000/products?category=Electronics"

# Get a single product
curl http://localhost:3000/products/1

# Admin: add a product (goes to master)
curl -X POST http://localhost:3000/admin/products \
  -H "Content-Type: application/json" \
  -d '{"title":"New Widget","description":"A shiny new widget","price":29.99,"color":"Blue","category":"Electronics","stock":50}'

# Admin: update product title (goes to master, replicates automatically)
curl -X PUT http://localhost:3000/admin/products/1 \
  -H "Content-Type: application/json" \
  -d '{"title":"Updated Widget Name"}'

# Verify the update propagated to replica (run a few times, you'll hit both)
curl http://localhost:3000/products/1

# Check replication status
curl http://localhost:3000/replication
```

Watch server logs - each query is tagged `[MASTER :5432]` or `[REPLICA:5433]` so you can see the read distribution.

## Cleanup

```bash
docker compose down -v
```

## Related

- Blog post: [Understanding Database Scaling and Sharding Patterns](https://pulkitxm.com/series/system-design/understanding-database-scaling-sharding)
- Blog post: [High Availability](https://pulkitxm.com/series/system-design/high-availability) (read replicas, replication)
