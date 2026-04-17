const mongoose = require("mongoose");
require("dotenv").config();

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/forgecart";

const products = [
  {
    id: "hoodie-2026",
    name: "Hackathon Hoodie 2026",
    category: "clothing",
    price: 59.99,
    image: "assets/images/hoodie.png",
    description: "Exclusive premium clothing designed for long hackathon sprints.",
    inStock: true,
  },
  {
    id: "tshirt-code-powered",
    name: "Code Powered T-Shirt",
    category: "clothing",
    price: 29.99,
    image: "assets/images/tshirt.png",
    description: "Soft premium tee for everyday coding comfort.",
    inStock: true,
  },
  {
    id: "dev-backpack",
    name: "Premium Dev Backpack",
    category: "accessories",
    price: 89.99,
    image: "assets/images/backpack.png",
    description: "High-capacity backpack built for laptops, cables, and gear.",
    inStock: true,
  },
  {
    id: "api-token-1y",
    name: "API Access Token (1Yr)",
    category: "digital",
    price: 149.99,
    image: "assets/images/api_token.png",
    description: "One-year premium API access for power users and teams.",
    inStock: true,
  },
  {
    id: "sticker-pack",
    name: "Developer Sticker Pack",
    category: "accessories",
    price: 14.99,
    image: "assets/images/stickers.png",
    description: "Curated sticker collection for laptops and workstations.",
    inStock: true,
  },
  {
    id: "forge-mug",
    name: "Forge Coffee Mug",
    category: "accessories",
    price: 24.99,
    image: "assets/images/mug.png",
    description: "Ceramic mug to keep caffeine deployment continuous.",
    inStock: true,
  },
];

const productSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    category: { type: String, required: true },
    price: { type: Number, required: true },
    image: { type: String, required: true },
    description: { type: String, required: true },
    inStock: { type: Boolean, default: true },
  },
  { versionKey: false }
);

const Product = mongoose.model("BootstrapProduct", productSchema, "products");

const run = async () => {
  await mongoose.connect(MONGODB_URI);
  console.log(`Connected to MongoDB at ${MONGODB_URI}`);

  const operations = products.map((product) => ({
    updateOne: {
      filter: { id: product.id },
      update: { $set: product },
      upsert: true,
    },
  }));

  await Product.bulkWrite(operations);

  console.log(`Bootstrapped ${products.length} products.`);
  await mongoose.disconnect();
};

run().catch(async (error) => {
  console.error("Mongo bootstrap failed:", error);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore disconnect errors during failure handling
  }
  process.exit(1);
});
