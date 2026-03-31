import { master, close } from "./db.js";

async function init() {
  await master.query(`
    CREATE TABLE IF NOT EXISTS products (
      id          SERIAL PRIMARY KEY,
      title       VARCHAR(200)  NOT NULL,
      description TEXT,
      price       NUMERIC(10,2) NOT NULL,
      color       VARCHAR(50),
      category    VARCHAR(100),
      image_url   TEXT,
      stock       INT           NOT NULL DEFAULT 0,
      created_at  TIMESTAMPTZ   DEFAULT NOW(),
      updated_at  TIMESTAMPTZ   DEFAULT NOW()
    );
  `);

  console.log("Schema created (products table).");
  await close();
}

init().catch((e) => {
  console.error(e);
  process.exit(1);
});
