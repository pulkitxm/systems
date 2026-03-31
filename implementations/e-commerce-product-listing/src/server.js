import express from "express";
import { read, write, close } from "./db.js";

const app = express();
app.use(express.json());

// ─── Admin APIs (shop owner) — writes go to MASTER ──────────

app.post("/admin/products", async (req, res) => {
  const { title, description, price, color, category, image_url, stock } = req.body;
  try {
    const { rows } = await write(
      `INSERT INTO products (title, description, price, color, category, image_url, stock)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [title, description, price, color, category, image_url, stock || 0]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.put("/admin/products/:id", async (req, res) => {
  const { title, description, price, color, category, image_url, stock } = req.body;
  try {
    const { rows } = await write(
      `UPDATE products SET
         title       = COALESCE($1, title),
         description = COALESCE($2, description),
         price       = COALESCE($3, price),
         color       = COALESCE($4, color),
         category    = COALESCE($5, category),
         image_url   = COALESCE($6, image_url),
         stock       = COALESCE($7, stock),
         updated_at  = NOW()
       WHERE id = $8 RETURNING *`,
      [title, description, price, color, category, image_url, stock, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: "product not found" });
    res.json(rows[0]);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.delete("/admin/products/:id", async (req, res) => {
  try {
    const { rowCount } = await write(
      "DELETE FROM products WHERE id = $1",
      [req.params.id]
    );
    if (!rowCount) return res.status(404).json({ error: "product not found" });
    res.json({ deleted: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// ─── Catalog APIs (customers) — reads split between MASTER & REPLICA ─

app.get("/products", async (req, res) => {
  const { category, color, sort } = req.query;

  let query = "SELECT * FROM products WHERE 1=1";
  const params = [];

  if (category) {
    params.push(category);
    query += ` AND category = $${params.length}`;
  }
  if (color) {
    params.push(color);
    query += ` AND color = $${params.length}`;
  }

  if (sort === "price_asc") query += " ORDER BY price ASC";
  else if (sort === "price_desc") query += " ORDER BY price DESC";
  else query += " ORDER BY id";

  try {
    const { rows } = await read(query, params);
    res.json({ count: rows.length, products: rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/products/:id", async (req, res) => {
  try {
    const { rows } = await read(
      "SELECT * FROM products WHERE id = $1",
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: "product not found" });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Health & replication info ───────────────────────────────

app.get("/health", async (_req, res) => {
  try {
    await read("SELECT 1");
    await write("SELECT 1");
    res.json({ status: "ok", master: "connected", replica: "connected" });
  } catch (e) {
    res.status(500).json({ status: "error", error: e.message });
  }
});

app.get("/replication", async (_req, res) => {
  const { rows } = await write(
    `SELECT client_addr, state, sent_lsn, replay_lsn, replay_lag
     FROM pg_stat_replication`
  );
  res.json(rows);
});

// ─── Start ───────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\nCatalog API listening on http://localhost:${PORT}\n`);
  console.log("  Admin writes  -> MASTER  (port 5432)");
  console.log("  Customer reads -> randomly MASTER (5432) or REPLICA (5433)\n");
});

process.on("SIGINT", async () => {
  await close();
  process.exit();
});
