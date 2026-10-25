// 지급내역(payouts) 데이터를 실제로 영속 저장하는 SQLite DB.
// Node 22+ 내장 모듈(node:sqlite)을 사용해 별도 네이티브 빌드 없이 동작합니다.
// 여러 도메인(ecosystem.config.js의 5개 프로세스)이 같은 파일을 보도록
// 경로를 repo 루트의 data/payouts.db 로 고정합니다.
const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = path.join(DATA_DIR, 'payouts.db');
const db = new DatabaseSync(DB_PATH);

// WAL 모드: 여러 프로세스(포트별 서버)가 동시에 같은 파일에 접근해도 안전하게.
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

db.exec(`
  CREATE TABLE IF NOT EXISTS payouts (
    id TEXT PRIMARY KEY,
    order_no TEXT,
    created_at TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    brand TEXT,
    brand_name TEXT,
    denom INTEGER NOT NULL,
    qty INTEGER NOT NULL,
    memo TEXT,
    source TEXT DEFAULT 'admin',
    created_row_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS payout_pins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    payout_id TEXT NOT NULL REFERENCES payouts(id) ON DELETE CASCADE,
    pin TEXT NOT NULL UNIQUE
  );

  CREATE TABLE IF NOT EXISTS payout_images (
    id TEXT PRIMARY KEY,
    payout_id TEXT NOT NULL REFERENCES payouts(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    mime TEXT,
    created_row_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_payouts_order_no ON payouts(order_no);
  CREATE INDEX IF NOT EXISTS idx_payout_pins_payout_id ON payout_pins(payout_id);
  CREATE INDEX IF NOT EXISTS idx_payout_images_payout_id ON payout_images(payout_id);
`);

function listPayouts() {
  const rows = db.prepare('SELECT * FROM payouts ORDER BY created_at DESC, id DESC').all();
  const pinsByPayout = {};
  for (const r of db.prepare('SELECT payout_id, pin FROM payout_pins ORDER BY id ASC').all()) {
    (pinsByPayout[r.payout_id] ||= []).push(r.pin);
  }
  const imagesByPayout = {};
  for (const r of db.prepare('SELECT payout_id, id FROM payout_images ORDER BY created_row_at ASC').all()) {
    (imagesByPayout[r.payout_id] ||= []).push(r.id);
  }

  return rows.map((r) => ({
    id: r.id,
    orderNo: r.order_no || '',
    createdAt: r.created_at,
    customer: { name: r.customer_name },
    brand: r.brand || '',
    brandName: r.brand_name || '',
    denom: r.denom,
    qty: r.qty,
    memo: r.memo || '',
    pins: pinsByPayout[r.id] || [],
    images: imagesByPayout[r.id] || [],
  }));
}

function insertPayout(record) {
  db.prepare(`
    INSERT INTO payouts (id, order_no, created_at, customer_name, brand, brand_name, denom, qty, memo, source)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    record.id,
    record.orderNo || '',
    record.createdAt,
    record.customer.name,
    record.brand || '',
    record.brandName || '',
    record.denom,
    record.qty,
    record.memo || '',
    record.source || 'admin',
  );

  const insertPin = db.prepare('INSERT INTO payout_pins (payout_id, pin) VALUES (?, ?)');
  for (const pin of record.pins || []) {
    insertPin.run(record.id, pin);
  }

  return record;
}

function deletePayout(id) {
  const images = db.prepare('SELECT id, filename FROM payout_images WHERE payout_id = ?').all(id);
  db.prepare('DELETE FROM payouts WHERE id = ?').run(id);
  return images;
}

function addImage(payoutId, imageId, filename, mime) {
  db.prepare('INSERT INTO payout_images (id, payout_id, filename, mime) VALUES (?, ?, ?, ?)')
    .run(imageId, payoutId, filename, mime || '');
}

function getImage(imageId) {
  return db.prepare('SELECT * FROM payout_images WHERE id = ?').get(imageId);
}

function existingPins() {
  return db.prepare('SELECT pin FROM payout_pins').all().map((r) => r.pin);
}

module.exports = {
  db,
  listPayouts,
  insertPayout,
  deletePayout,
  addImage,
  getImage,
  existingPins,
};
