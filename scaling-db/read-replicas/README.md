# Read replicas demo

Small Node.js demo: PostgreSQL primary + replicas, routing reads vs writes with `pg`.

## Quick start

```bash
docker compose up -d
pnpm install
pnpm run setup
pnpm run populate
pnpm run demo
```

## Related

- Blog post: [Understanding Database Scaling and Sharding Patterns](https://pulkitxm.com/series/system-design/understanding-database-scaling-sharding)
- Blog post: [High Availability](https://pulkitxm.com/series/system-design/high-availability)

For a deeper replication walkthrough (WAL, failover), see [`../../db-replica/`](../../db-replica).
