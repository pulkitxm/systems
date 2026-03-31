import { master, close } from "./db.js";

const CATEGORIES = [
  "Electronics", "Clothing", "Home & Kitchen", "Books",
  "Toys", "Sports", "Beauty", "Grocery", "Stationery", "Accessories",
];

const COLORS = [
  "Red", "Blue", "Green", "Black", "White",
  "Yellow", "Pink", "Grey", "Brown", "Orange",
];

const ADJECTIVES = [
  "Premium", "Classic", "Eco-Friendly", "Compact", "Deluxe",
  "Handmade", "Organic", "Vintage", "Modern", "Ultra",
];

const NOUNS = [
  "Widget", "Gadget", "Lamp", "Backpack", "Notebook",
  "Mug", "T-Shirt", "Sneakers", "Headphones", "Watch",
  "Candle", "Soap", "Towel", "Charger", "Bottle",
  "Pen", "Chair", "Cushion", "Hat", "Scarf",
];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomPrice() {
  return (Math.random() * 200 + 1).toFixed(2);
}

function randomStock() {
  return Math.floor(Math.random() * 100);
}

async function seed() {
  await master.query("DELETE FROM products");

  const values = [];
  const params = [];
  let idx = 1;

  for (let i = 0; i < 100; i++) {
    const title = `${pick(ADJECTIVES)} ${pick(NOUNS)}`;
    const description = `A high-quality ${title.toLowerCase()} perfect for everyday use.`;
    const price = randomPrice();
    const color = pick(COLORS);
    const category = pick(CATEGORIES);
    const imageUrl = `https://picsum.photos/seed/product${i + 1}/400/400`;
    const stock = randomStock();

    values.push(
      `($${idx}, $${idx + 1}, $${idx + 2}, $${idx + 3}, $${idx + 4}, $${idx + 5}, $${idx + 6})`
    );
    params.push(title, description, price, color, category, imageUrl, stock);
    idx += 7;
  }

  await master.query(
    `INSERT INTO products (title, description, price, color, category, image_url, stock)
     VALUES ${values.join(", ")}`,
    params
  );

  console.log("Seeded 100 random products into catalog.");
  await close();
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
