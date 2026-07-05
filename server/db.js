const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'app.sqlite'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    category TEXT NOT NULL,
    name TEXT NOT NULL,
    denom INTEGER NOT NULL,
    discount REAL NOT NULL,
    price INTEGER NOT NULL,
    brand_class TEXT NOT NULL,
    brand_label TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    total INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT '접수완료',
    buyer_name TEXT NOT NULL,
    buyer_phone TEXT NOT NULL,
    buyer_email TEXT NOT NULL,
    delivery_method TEXT NOT NULL,
    memo TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id TEXT NOT NULL REFERENCES orders(id),
    product_id TEXT NOT NULL,
    name TEXT NOT NULL,
    price INTEGER NOT NULL,
    qty INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
  CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
`);

const productCount = db.prepare('SELECT COUNT(*) AS n FROM products').get().n;

if (productCount === 0) {
  const seed = db.prepare(`
    INSERT INTO products (id, category, name, denom, discount, price, brand_class, brand_label, sort_order)
    VALUES (@id, @category, @name, @denom, @discount, @price, @brandClass, @brandLabel, @sortOrder)
  `);

  const salePrice = (denom, discount) => Math.round((denom * (1 - discount / 100)) / 10) * 10;

  const products = [
    { id: 'lotte-500000', category: 'lotte', name: '롯데 50만원권', denom: 500000, discount: 3.5, brandClass: 'brand-lotte', brandLabel: 'LOTTE' },
    { id: 'lotte-100000', category: 'lotte', name: '롯데 10만원권', denom: 100000, discount: 3.5, brandClass: 'brand-lotte', brandLabel: 'LOTTE' },
    { id: 'shinsegae-500000', category: 'shinsegae', name: '신세계 50만원권', denom: 500000, discount: 2.95, brandClass: 'brand-shinsegae', brandLabel: 'SHINSEGAE' },
    { id: 'shinsegae-100000', category: 'shinsegae', name: '신세계 10만원권', denom: 100000, discount: 2.95, brandClass: 'brand-shinsegae', brandLabel: 'SHINSEGAE' },
    // Hyundai 500,000 is listed at 484,000 (not the 483,500 the 3.3% rate would compute) - kept as an explicit override to match the real posted price.
    { id: 'hyundai-500000', category: 'hyundai', name: '현대 50만원권', denom: 500000, discount: 3.3, price: 484000, brandClass: 'brand-hyundai', brandLabel: 'HYUNDAI' },
    { id: 'hyundai-100000', category: 'hyundai', name: '현대 10만원권', denom: 100000, discount: 3.3, brandClass: 'brand-hyundai', brandLabel: 'HYUNDAI' },
    { id: 'galleria-500000', category: 'galleria', name: '갤러리아 50만원권', denom: 500000, discount: 3.4, brandClass: 'brand-galleria', brandLabel: 'GALLERIA' },
    { id: 'galleria-100000', category: 'galleria', name: '갤러리아 10만원권', denom: 100000, discount: 3.4, brandClass: 'brand-galleria', brandLabel: 'GALLERIA' },
    { id: 'guk-100000', category: 'guk', name: '국민관광 10만원권', denom: 100000, discount: 3, brandClass: 'brand-guk', brandLabel: '국민관광' },
    { id: 'keumkang-100000', category: 'keumkang', name: '금강 10만원권', denom: 100000, discount: 26, brandClass: 'brand-keumkang', brandLabel: '금강제화' },
    { id: 'keumkang-50000', category: 'keumkang', name: '금강 5만원권', denom: 50000, discount: 26, brandClass: 'brand-keumkang', brandLabel: '금강제화' },
  ];

  const insertAll = db.transaction((rows) => {
    rows.forEach((p, i) => {
      seed.run({
        id: p.id,
        category: p.category,
        name: p.name,
        denom: p.denom,
        discount: p.discount,
        price: p.price !== undefined ? p.price : salePrice(p.denom, p.discount),
        brandClass: p.brandClass,
        brandLabel: p.brandLabel,
        sortOrder: i,
      });
    });
  });

  insertAll(products);
}

// Corrections for databases that were already seeded before a price fix -
// re-applied on every startup so existing deployments pick them up too.
const priceCorrections = [{ id: 'hyundai-500000', price: 484000 }];
const correctPrice = db.prepare('UPDATE products SET price = ? WHERE id = ? AND price != ?');
priceCorrections.forEach((c) => correctPrice.run(c.price, c.id, c.price));

module.exports = db;
