# Sharding demo

PostgreSQL split across multiple instances with an application-side shard router (`shard-manager.js`).

## Quick start

```bash
docker compose up -d
npm install
npm run setup
npm run populate
npm run demo
npm run query
```

## Related

- Blog post: [Understanding Database Scaling and Sharding Patterns](https://pulkitxm.com/series/system-design/understanding-database-scaling-sharding)
