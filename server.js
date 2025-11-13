const express = require('express');
const cors = require('cors');
const crypto = require('crypto');

const app = express();

app.use(cors());
app.use(express.json());

const users = new Map();
const products = new Map();

const createId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomBytes === 'function'
  ) {
    return crypto.randomBytes(8).toString('hex');
  }

  return Math.random().toString(36).slice(2, 10);
};

const ensureNumber = (value, fallback = 0) => {
  if (value === null || value === undefined || value === '') return fallback;
  const asNumber = Number(value);
  return Number.isFinite(asNumber) ? asNumber : fallback;
};

const pickUserResponse = (user) => ({
  _id: user._id,
  email: user.email,
  name: user.name,
});

const seedUsers = () => {
  const seed = [
    {
      email: 'ethan.carter@gmail.com',
      password: 'password123',
      name: 'Ethan Carter',
    },
  ];

  seed.forEach((entry) => {
    if (!users.has(entry.email)) {
      const _id = createId();
      users.set(entry.email, { _id, ...entry });
    }
  });
};

const seedProducts = () => {
  const defaults = [
    {
      productName: 'Apple AirTag',
      sku: 'SKU-AIRTAG-001',
      description: 'Bluetooth tracker',
      category: 'Electronics',
      availableQty: 42,
      unit: 'pcs',
      cost: 2200,
      mrp: 2990,
      notes: 'Latest batch',
      supplier: 'Apple Inc.',
      location: 'Aisle 3',
      minStock: 10,
    },
    {
      productName: 'Logitech MX Keys',
      sku: 'SKU-LOGI-MXK',
      description: 'Wireless keyboard',
      category: 'Electronics',
      availableQty: 12,
      unit: 'pcs',
      cost: 8500,
      mrp: 9990,
      notes: 'Needs accessories section update',
      supplier: 'Logitech',
      location: 'Aisle 4',
      minStock: 8,
    },
    {
      productName: 'Standing Desk',
      sku: 'SKU-DESK-STD',
      description: 'Height adjustable desk',
      category: 'Furniture',
      availableQty: 4,
      unit: 'pcs',
      cost: 18000,
      mrp: 21999,
      notes: 'New inventory',
      supplier: 'FlexiDesk',
      location: 'Warehouse',
      minStock: 5,
    },
  ];

  defaults.forEach((item) => {
    const _id = createId();
    products.set(_id, { _id, ...item, createdAt: new Date().toISOString() });
  });
};

seedUsers();
seedProducts();

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.post('/user/register', (req, res) => {
  const { email, password, name } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  if (users.has(email)) {
    return res.status(409).json({ error: 'User already exists.' });
  }

  const newUser = {
    _id: createId(),
    email: email.trim().toLowerCase(),
    password,
    name: name?.trim() || email.split('@')[0],
  };

  users.set(newUser.email, newUser);

  return res.status(201).json(pickUserResponse(newUser));
});

app.post('/user/signin', (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const stored = users.get(email.trim().toLowerCase());

  if (!stored || stored.password !== password) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  return res.json(pickUserResponse(stored));
});

app.get('/inventory/getall', (_req, res) => {
  return res.json(Array.from(products.values()));
});

app.post('/inventory/create', (req, res) => {
  const payload = req.body || {};
  const requiredFields = ['productName', 'sku'];

  const missing = requiredFields.filter((field) => !payload[field]);
  if (missing.length) {
    return res
      .status(400)
      .json({ error: `Missing required field(s): ${missing.join(', ')}` });
  }

  const hasDuplicateSku = Array.from(products.values()).some(
    (product) => product.sku.toLowerCase() === payload.sku.toLowerCase()
  );

  if (hasDuplicateSku) {
    return res.status(409).json({ error: 'SKU must be unique.' });
  }

  const product = {
    _id: createId(),
    productName: payload.productName,
    sku: payload.sku,
    description: payload.description ?? '',
    category: payload.category ?? '',
    availableQty: ensureNumber(payload.availableQty),
    unit: payload.unit ?? 'pcs',
    cost: ensureNumber(payload.cost, 0),
    mrp: ensureNumber(payload.mrp, 0),
    notes: payload.notes ?? '',
    supplier: payload.supplier ?? '',
    location: payload.location ?? '',
    minStock: ensureNumber(payload.minStock, 0),
    createdAt: new Date().toISOString(),
  };

  products.set(product._id, product);

  return res.status(201).json(product);
});

app.get('/inventory/stock-summary', (_req, res) => {
  const all = Array.from(products.values());

  const summary = all.reduce(
    (acc, product) => {
      acc.totalProducts += 1;

      if (product.availableQty > 0) {
        acc.inStockCount += 1;
      }

      if (product.availableQty <= product.minStock) {
        acc.lowStockCount += 1;
      }

      if (product.availableQty === 0) {
        acc.outOfStockCount += 1;
      }

      return acc;
    },
    {
      totalProducts: 0,
      inStockCount: 0,
      lowStockCount: 0,
      outOfStockCount: 0,
    }
  );

  return res.json(summary);
});

app.get('/inventory/alerts/lowstockcount', (_req, res) => {
  const count = Array.from(products.values()).filter(
    (product) => product.availableQty <= product.minStock
  ).length;

  return res.json({ count });
});

app.get('/inventory/alerts/lowstock', (_req, res) => {
  const lowStockProducts = Array.from(products.values()).filter(
    (product) => product.availableQty <= product.minStock
  );

  return res.json(lowStockProducts);
});

app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

const PORT = process.env.PORT || 3000;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Inventory backend running on port ${PORT}`);
  });
}

module.exports = app;
