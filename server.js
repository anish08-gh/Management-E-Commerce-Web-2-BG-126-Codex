const express = require("express");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const mongoose = require("mongoose");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/forgecart";
const AUTH_TOKEN_TTL_DAYS = Math.max(1, Number(process.env.AUTH_TOKEN_TTL_DAYS) || 7);

const formatMoney = (amount) => Number(Number(amount).toFixed(2));
const hashLegacyPassword = (password) =>
  crypto.createHash("sha256").update(password).digest("hex");
const hashToken = (token) =>
  crypto.createHash("sha256").update(token).digest("hex");
const newId = (prefix) => `${prefix}_${crypto.randomBytes(8).toString("hex")}`;
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const createAuthToken = () => crypto.randomBytes(32).toString("hex");
const createExpiryDate = () => {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + AUTH_TOKEN_TTL_DAYS);
  return expiresAt;
};

const productSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    category: { type: String, required: true, index: true },
    price: { type: Number, required: true },
    image: { type: String, required: true },
    description: { type: String, required: true },
    inStock: { type: Boolean, default: true },
  },
  { versionKey: false }
);

const userSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, index: true },
    passwordHash: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

const cartSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, unique: true, index: true },
    items: [
      {
        _id: false,
        productId: { type: String, required: true },
        quantity: { type: Number, required: true, min: 1 },
      },
    ],
  },
  { versionKey: false }
);

const orderItemSchema = new mongoose.Schema(
  {
    _id: false,
    productId: { type: String, required: true },
    name: { type: String, required: true },
    image: { type: String, required: true },
    price: { type: Number, required: true },
    quantity: { type: Number, required: true },
    lineTotal: { type: Number, required: true },
  },
  { versionKey: false }
);

const orderSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    userId: { type: String, required: true, index: true },
    timestamp: { type: Date, default: Date.now },
    status: { type: String, default: "Executed" },
    items: { type: [orderItemSchema], default: [] },
    total: { type: Number, required: true },
    shipping: {
      fullName: { type: String, required: true },
      email: { type: String, required: true },
      address: { type: String, required: true },
    },
  },
  { versionKey: false }
);

const sessionSchema = new mongoose.Schema(
  {
    tokenHash: { type: String, required: true, unique: true, index: true },
    userId: { type: String, required: true, index: true },
    expiresAt: { type: Date, required: true },
    createdAt: { type: Date, default: Date.now, index: true },
  },
  { versionKey: false }
);

sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const Product = mongoose.model("Product", productSchema);
const User = mongoose.model("User", userSchema);
const Cart = mongoose.model("Cart", cartSchema);
const Order = mongoose.model("Order", orderSchema);
const Session = mongoose.model("Session", sessionSchema);

app.use(express.json());
app.use(express.static(__dirname));

const getAuthUser = async (req) => {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return null;
  }

  const session = await Session.findOne({
    tokenHash: hashToken(token),
    expiresAt: { $gt: new Date() },
  }).lean();

  if (!session) {
    return null;
  }

  const userId = session.userId;
  const user = await User.findOne({ id: userId }).lean();

  if (!user) {
    await Session.deleteOne({ tokenHash: hashToken(token) });
    return null;
  }

  return { token, user };
};

const authRequired = async (req, res, next) => {
  try {
    const auth = await getAuthUser(req);
    if (!auth) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    req.auth = auth;
    next();
  } catch (error) {
    next(error);
  }
};

const buildCartResponse = async (userId) => {
  const cartDoc = await Cart.findOne({ userId }).lean();
  const rawItems = cartDoc?.items || [];
  const productIds = rawItems.map((item) => item.productId);
  const products = await Product.find({ id: { $in: productIds } }).lean();
  const productMap = new Map(products.map((product) => [product.id, product]));

  const items = rawItems
    .map((item) => {
      const product = productMap.get(item.productId);
      if (!product) {
        return null;
      }

      const quantity = Math.max(1, Number(item.quantity || 1));
      const lineTotal = formatMoney(product.price * quantity);

      return {
        productId: product.id,
        name: product.name,
        image: product.image,
        price: product.price,
        quantity,
        lineTotal,
      };
    })
    .filter(Boolean);

  return {
    items,
    subtotal: formatMoney(items.reduce((sum, item) => sum + item.lineTotal, 0)),
  };
};

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    database: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    auth: "mongo-persistent-sessions",
    time: new Date().toISOString(),
  });
});

app.post("/api/auth/register", async (req, res, next) => {
  try {
    const { name, email, password } = req.body || {};

    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ message: "Name, email, and password are required." });
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    const existingUser = await User.findOne({ email: normalizedEmail }).lean();

    if (existingUser) {
      return res
        .status(409)
        .json({ message: "An account with this email already exists." });
    }

    const passwordValue = String(password);
    await User.create({
      id: newId("usr"),
      name: String(name).trim(),
      email: normalizedEmail,
      passwordHash: await bcrypt.hash(passwordValue, 12),
      createdAt: new Date(),
    });

    res.status(201).json({ message: "Account created successfully." });
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/login", async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    const passwordValue = String(password);
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    let passwordMatches = false;
    const storedHash = user.passwordHash || "";

    if (storedHash.startsWith("$2")) {
      passwordMatches = await bcrypt.compare(passwordValue, storedHash);
    } else {
      passwordMatches = storedHash === hashLegacyPassword(passwordValue);
      if (passwordMatches) {
        user.passwordHash = await bcrypt.hash(passwordValue, 12);
        await user.save();
      }
    }

    if (!passwordMatches) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    const token = createAuthToken();
    await Session.create({
      tokenHash: hashToken(token),
      userId: user.id,
      expiresAt: createExpiryDate(),
      createdAt: new Date(),
    });

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/logout", authRequired, async (req, res, next) => {
  try {
    await Session.deleteOne({ tokenHash: hashToken(req.auth.token) });
    res.json({ message: "Logged out." });
  } catch (error) {
    next(error);
  }
});

app.get("/api/auth/me", authRequired, (req, res) => {
  const { user } = req.auth;
  res.json({ id: user.id, name: user.name, email: user.email });
});

app.get("/api/products", async (req, res, next) => {
  try {
    const { search = "", category = "all" } = req.query;
    const searchText = String(search).toLowerCase().trim();
    const selectedCategory = String(category).toLowerCase().trim();

    const query = {};

    if (selectedCategory !== "all") {
      query.category = selectedCategory;
    }

    if (searchText) {
      const searchPattern = new RegExp(escapeRegex(searchText), "i");
      query.$or = [{ name: searchPattern }, { description: searchPattern }];
    }

    const products = await Product.find(query).sort({ name: 1 }).lean();
    res.json(products);
  } catch (error) {
    next(error);
  }
});

app.get("/api/products/:id", async (req, res, next) => {
  try {
    const product = await Product.findOne({ id: req.params.id }).lean();

    if (!product) {
      return res.status(404).json({ message: "Product not found." });
    }

    res.json(product);
  } catch (error) {
    next(error);
  }
});

app.get("/api/cart", authRequired, async (req, res, next) => {
  try {
    const cart = await buildCartResponse(req.auth.user.id);
    res.json(cart);
  } catch (error) {
    next(error);
  }
});

app.post("/api/cart/items", authRequired, async (req, res, next) => {
  try {
    const { productId, quantity = 1 } = req.body || {};

    if (!productId) {
      return res.status(400).json({ message: "productId is required." });
    }

    const product = await Product.findOne({ id: productId }).lean();
    if (!product) {
      return res.status(404).json({ message: "Product not found." });
    }

    const increment = Math.max(1, Number(quantity) || 1);
    const cart = await Cart.findOne({ userId: req.auth.user.id });

    if (!cart) {
      await Cart.create({
        userId: req.auth.user.id,
        items: [{ productId, quantity: increment }],
      });
    } else {
      const existing = cart.items.find((item) => item.productId === productId);

      if (existing) {
        existing.quantity += increment;
      } else {
        cart.items.push({ productId, quantity: increment });
      }

      await cart.save();
    }

    const updated = await buildCartResponse(req.auth.user.id);
    res.status(201).json(updated);
  } catch (error) {
    next(error);
  }
});

app.patch("/api/cart/items/:productId", authRequired, async (req, res, next) => {
  try {
    const { quantity } = req.body || {};

    if (typeof quantity === "undefined") {
      return res.status(400).json({ message: "quantity is required." });
    }

    const nextQty = Number(quantity);
    if (Number.isNaN(nextQty)) {
      return res.status(400).json({ message: "quantity must be a number." });
    }

    const cart = await Cart.findOne({ userId: req.auth.user.id });
    const item = cart?.items.find((entry) => entry.productId === req.params.productId);

    if (!item) {
      return res.status(404).json({ message: "Cart item not found." });
    }

    if (nextQty <= 0) {
      cart.items = cart.items.filter((entry) => entry.productId !== req.params.productId);
    } else {
      item.quantity = Math.floor(nextQty);
    }

    await cart.save();

    const updated = await buildCartResponse(req.auth.user.id);
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

app.delete("/api/cart/items/:productId", authRequired, async (req, res, next) => {
  try {
    const cart = await Cart.findOne({ userId: req.auth.user.id });

    if (cart) {
      cart.items = cart.items.filter((entry) => entry.productId !== req.params.productId);
      await cart.save();
    }

    const updated = await buildCartResponse(req.auth.user.id);
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

app.post("/api/orders", authRequired, async (req, res, next) => {
  try {
    const { fullName, email, address } = req.body || {};

    if (!fullName || !email || !address) {
      return res
        .status(400)
        .json({ message: "fullName, email and address are required." });
    }

    const cart = await buildCartResponse(req.auth.user.id);
    if (cart.items.length === 0) {
      return res.status(400).json({ message: "Cart is empty." });
    }

    const order = await Order.create({
      id: `ORD-${crypto.randomBytes(3).toString("hex").toUpperCase()}`,
      userId: req.auth.user.id,
      timestamp: new Date(),
      status: "Executed",
      items: cart.items,
      total: cart.subtotal,
      shipping: {
        fullName: String(fullName).trim(),
        email: String(email).trim(),
        address: String(address).trim(),
      },
    });

    await Cart.findOneAndUpdate(
      { userId: req.auth.user.id },
      { $set: { items: [] } },
      { upsert: true }
    );

    res.status(201).json(order.toObject());
  } catch (error) {
    next(error);
  }
});

app.get("/api/orders", authRequired, async (req, res, next) => {
  try {
    const orders = await Order.find({ userId: req.auth.user.id })
      .sort({ timestamp: -1 })
      .lean();
    res.json(orders);
  } catch (error) {
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  console.error(error);

  if (error?.code === 11000) {
    return res.status(409).json({ message: "A record with this value already exists." });
  }

  res.status(500).json({ message: "Something went wrong." });
});

const startServer = async () => {
  await mongoose.connect(MONGODB_URI);
  console.log(`Connected to MongoDB at ${MONGODB_URI}`);

  app.listen(PORT, () => {
    console.log(`ForgeCart backend running on http://localhost:${PORT}`);
  });
};

startServer().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
