// 지급내역(payouts) 데이터를 실제로 영속 저장하는 SQLite DB.
// Node 22+ 내장 모듈(node:sqlite)을 사용해 별도 네이티브 빌드 없이 동작합니다.
// 여러 도메인(ecosystem.config.js의 5개 프로세스)이 같은 파일을 보도록
// 경로를 repo 루트의 data/payouts.db 로 고정합니다.
//
// 한 "거래"(payouts)는 여러 액면(payout_items)을 포함할 수 있습니다.
// 예: 입금 1건을 50만원×7 + 10만원×2 + 1만원×1 로 지급한 경우,
// payouts 테이블엔 거래 1행만 생기고, payout_items에 액면별로 3행이 생깁니다.
// 핀번호/사진은 액면(아이템) 단위로 붙습니다.
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
    memo TEXT,
    source TEXT DEFAULT 'admin',
    created_row_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS payout_items (
    id TEXT PRIMARY KEY,
    payout_id TEXT NOT NULL REFERENCES payouts(id) ON DELETE CASCADE,
    denom INTEGER NOT NULL,
    qty INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS payout_pins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id TEXT NOT NULL REFERENCES payout_items(id) ON DELETE CASCADE,
    pin TEXT NOT NULL UNIQUE
  );

  CREATE TABLE IF NOT EXISTS payout_images (
    id TEXT PRIMARY KEY,
    item_id TEXT NOT NULL REFERENCES payout_items(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    mime TEXT,
    created_row_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_payouts_order_no ON payouts(order_no);
  CREATE INDEX IF NOT EXISTS idx_payout_items_payout_id ON payout_items(payout_id);
  CREATE INDEX IF NOT EXISTS idx_payout_pins_item_id ON payout_pins(item_id);
  CREATE INDEX IF NOT EXISTS idx_payout_images_item_id ON payout_images(item_id);
`);

function listPayouts() {
  const payoutRows = db.prepare('SELECT * FROM payouts ORDER BY created_at DESC, id DESC').all();
  const itemRows = db.prepare('SELECT * FROM payout_items ORDER BY rowid ASC').all();
  const pinRows = db.prepare('SELECT item_id, pin FROM payout_pins ORDER BY id ASC').all();
  const imageRows = db.prepare('SELECT item_id, id FROM payout_images ORDER BY created_row_at ASC').all();

  const pinsByItem = {};
  pinRows.forEach((r) => { (pinsByItem[r.item_id] ||= []).push(r.pin); });
  const imagesByItem = {};
  imageRows.forEach((r) => { (imagesByItem[r.item_id] ||= []).push(r.id); });

  const itemsByPayout = {};
  itemRows.forEach((it) => {
    (itemsByPayout[it.payout_id] ||= []).push({
      id: it.id,
      denom: it.denom,
      qty: it.qty,
      pins: pinsByItem[it.id] || [],
      images: imagesByItem[it.id] || [],
    });
  });

  return payoutRows.map((r) => ({
    id: r.id,
    orderNo: r.order_no || '',
    createdAt: r.created_at,
    customer: { name: r.customer_name },
    brand: r.brand || '',
    brandName: r.brand_name || '',
    memo: r.memo || '',
    items: itemsByPayout[r.id] || [],
  }));
}

function nextItemSeq(payoutId) {
  const row = db.prepare('SELECT COUNT(*) AS n FROM payout_items WHERE payout_id = ?').get(payoutId);
  return (row.n || 0) + 1;
}

// 같은 order_no로 다시 들어오면(관리자가 같은 거래에 다른 액면을 추가 입력한 경우)
// 새 거래를 만들지 않고 기존 거래에 액면(아이템)만 추가합니다. order_no가 없으면
// 매번 새 거래로 취급합니다.
function createOrAppendPayout(input) {
  const existing = input.orderNo
    ? db.prepare('SELECT id FROM payouts WHERE order_no = ?').get(input.orderNo)
    : null;

  let payoutId;
  if (existing) {
    payoutId = existing.id;
  } else {
    // 주문번호를 그대로 id로 쓰지 않습니다(사용자가 입력한 임의 문자열이 다른 거래의
    // 자동 생성 id와 우연히 겹치면 UNIQUE 제약 위반이 날 수 있어서). id는 항상 따로
    // 생성하고, order_no는 병합 검색용 별도 컬럼으로만 씁니다.
    payoutId = input.id || `PO-${input.createdAt.slice(0, 10).replace(/-/g, '')}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    db.prepare(`
      INSERT INTO payouts (id, order_no, created_at, customer_name, brand, brand_name, memo, source)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      payoutId,
      input.orderNo || '',
      input.createdAt,
      input.customerName,
      input.brand || '',
      input.brandName || '',
      input.memo || '',
      input.source || 'admin',
    );
  }

  const seq = nextItemSeq(payoutId);
  const itemId = `${payoutId}-I${seq}`;
  db.prepare('INSERT INTO payout_items (id, payout_id, denom, qty) VALUES (?, ?, ?, ?)')
    .run(itemId, payoutId, input.denom, input.qty);

  const insertPin = db.prepare('INSERT INTO payout_pins (item_id, pin) VALUES (?, ?)');
  (input.pins || []).forEach((pin) => insertPin.run(itemId, pin));

  return { payoutId, itemId, merged: Boolean(existing) };
}

// 마이그레이션 등 "거래 단위로 이미 다 묶인" 데이터를 한 번에 넣을 때 씁니다.
// record: { id, orderNo, createdAt, customer:{name}, brand, brandName, memo, source,
//           items: [{ id?, denom, qty, pins: [] }] }
function insertPayoutWithItems(record) {
  db.prepare(`
    INSERT INTO payouts (id, order_no, created_at, customer_name, brand, brand_name, memo, source)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    record.id,
    record.orderNo || '',
    record.createdAt,
    record.customer.name,
    record.brand || '',
    record.brandName || '',
    record.memo || '',
    record.source || 'admin',
  );

  const insertItem = db.prepare('INSERT INTO payout_items (id, payout_id, denom, qty) VALUES (?, ?, ?, ?)');
  const insertPin = db.prepare('INSERT INTO payout_pins (item_id, pin) VALUES (?, ?)');

  (record.items || []).forEach((item, idx) => {
    const itemId = item.id || `${record.id}-I${idx + 1}`;
    insertItem.run(itemId, record.id, item.denom, item.qty);
    (item.pins || []).forEach((pin) => insertPin.run(itemId, pin));
  });

  return record;
}

function deletePayout(id) {
  const images = db.prepare(`
    SELECT pi.id, pi.filename FROM payout_images pi
    JOIN payout_items it ON it.id = pi.item_id
    WHERE it.payout_id = ?
  `).all(id);
  db.prepare('DELETE FROM payouts WHERE id = ?').run(id);
  return images;
}

function addImage(itemId, imageId, filename, mime) {
  db.prepare('INSERT INTO payout_images (id, item_id, filename, mime) VALUES (?, ?, ?, ?)')
    .run(imageId, itemId, filename, mime || '');
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
  createOrAppendPayout,
  insertPayoutWithItems,
  deletePayout,
  addImage,
  getImage,
  existingPins,
};
