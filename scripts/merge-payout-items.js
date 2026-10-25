// 1회성 스키마 마이그레이션: "거래 하나가 액면별로 여러 행(row)에 나뉘어 있던" 기존
// payouts 테이블을, "거래 1행 + 액면별 하위 아이템(payout_items)" 구조로 합칩니다.
//
// 예) 기존: payouts에 같은 order_no(MIG-...)를 가진 행이 3개(1만원/10만원/50만원 각각)
//     이후: payouts에 거래 1행 + payout_items에 액면 3행
//
// order_no가 비어 있던 행(관리자가 직접 등록한, 주문번호 없는 지급내역)은 원래부터
// "거래 1건 = 액면 1건"이었으므로 그대로 거래 1건 + 아이템 1건으로 변환됩니다.
//
// 실행: node scripts/merge-payout-items.js
// 이미 새 스키마(payout_items 테이블)로 변환돼 있으면 안전하게 중단합니다.

const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'payouts.db');
const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA foreign_keys = OFF;'); // 테이블을 드롭/재생성하는 동안 비활성화

function tableExists(name) {
  return !!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?").get(name);
}

function columnNames(table) {
  return db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
}

function run() {
  if (!tableExists('payouts')) {
    console.error('payouts 테이블이 없습니다. 먼저 서버를 한 번 실행해 DB를 초기화하세요.');
    process.exit(1);
  }

  const payoutCols = columnNames('payouts');
  if (tableExists('payout_items') || !payoutCols.includes('denom')) {
    console.log('이미 새 스키마(payout_items)로 변환되어 있는 것으로 보입니다. 건너뜁니다.');
    process.exit(0);
  }

  const oldPayouts = db.prepare('SELECT * FROM payouts ORDER BY rowid ASC').all();
  const oldPins = db.prepare('SELECT * FROM payout_pins').all();
  const oldImages = db.prepare('SELECT * FROM payout_images').all();

  const pinsByOldPayout = {};
  oldPins.forEach((r) => { (pinsByOldPayout[r.payout_id] ||= []).push(r.pin); });
  const imagesByOldPayout = {};
  oldImages.forEach((r) => { (imagesByOldPayout[r.payout_id] ||= []).push(r); });

  // order_no가 있으면 order_no 기준으로, 없으면 자기 자신의 id로 그룹핑(=혼자인 그룹).
  const groups = new Map(); // groupKey -> { payoutId, rows: [...] }
  oldPayouts.forEach((row) => {
    const groupKey = row.order_no ? `ON:${row.order_no}` : `ID:${row.id}`;
    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        payoutId: row.order_no || row.id,
        rows: [],
      });
    }
    groups.get(groupKey).rows.push(row);
  });

  // payoutId 충돌 체크(서로 다른 그룹이 같은 id를 쓰게 되는 경우는 없어야 함).
  const seenPayoutIds = new Set();
  for (const g of groups.values()) {
    if (seenPayoutIds.has(g.payoutId)) {
      console.error(`payout id 충돌 발생: ${g.payoutId}. 마이그레이션을 중단합니다.`);
      process.exit(1);
    }
    seenPayoutIds.add(g.payoutId);
  }

  db.exec('BEGIN');
  try {
    db.exec('DROP TABLE IF EXISTS payout_pins');
    db.exec('DROP TABLE IF EXISTS payout_images');
    db.exec('DROP TABLE IF EXISTS payout_items');
    db.exec('DROP TABLE IF EXISTS payouts');

    db.exec(`
      CREATE TABLE payouts (
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
      CREATE TABLE payout_items (
        id TEXT PRIMARY KEY,
        payout_id TEXT NOT NULL REFERENCES payouts(id) ON DELETE CASCADE,
        denom INTEGER NOT NULL,
        qty INTEGER NOT NULL
      );
      CREATE TABLE payout_pins (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        item_id TEXT NOT NULL REFERENCES payout_items(id) ON DELETE CASCADE,
        pin TEXT NOT NULL UNIQUE
      );
      CREATE TABLE payout_images (
        id TEXT PRIMARY KEY,
        item_id TEXT NOT NULL REFERENCES payout_items(id) ON DELETE CASCADE,
        filename TEXT NOT NULL,
        mime TEXT,
        created_row_at TEXT DEFAULT (datetime('now'))
      );
      CREATE INDEX idx_payouts_order_no ON payouts(order_no);
      CREATE INDEX idx_payout_items_payout_id ON payout_items(payout_id);
      CREATE INDEX idx_payout_pins_item_id ON payout_pins(item_id);
      CREATE INDEX idx_payout_images_item_id ON payout_images(item_id);
    `);

    const insertPayout = db.prepare(`
      INSERT INTO payouts (id, order_no, created_at, customer_name, brand, brand_name, memo, source)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertItem = db.prepare('INSERT INTO payout_items (id, payout_id, denom, qty) VALUES (?, ?, ?, ?)');
    const insertPin = db.prepare('INSERT INTO payout_pins (item_id, pin) VALUES (?, ?)');
    const insertImage = db.prepare('INSERT INTO payout_images (id, item_id, filename, mime) VALUES (?, ?, ?, ?)');

    let payoutCount = 0;
    let itemCount = 0;
    let pinCount = 0;
    let imageCount = 0;

    for (const group of groups.values()) {
      const rows = group.rows.slice().sort((a, b) => (a.rowid || 0) - (b.rowid || 0));
      const head = rows[0];

      insertPayout.run(
        group.payoutId,
        head.order_no || '',
        head.created_at,
        head.customer_name,
        head.brand || '',
        head.brand_name || '',
        head.memo || '',
        head.source || 'admin',
      );
      payoutCount += 1;

      rows.forEach((row) => {
        // 기존 행의 id를 그대로 아이템 id로 재사용해, 핀/사진 FK를 그대로 연결합니다.
        insertItem.run(row.id, group.payoutId, row.denom, row.qty);
        itemCount += 1;

        (pinsByOldPayout[row.id] || []).forEach((pin) => {
          insertPin.run(row.id, pin);
          pinCount += 1;
        });
        (imagesByOldPayout[row.id] || []).forEach((img) => {
          insertImage.run(img.id, row.id, img.filename, img.mime || '');
          imageCount += 1;
        });
      });
    }

    db.exec('COMMIT');
    console.log(`거래(payouts): ${payoutCount}건`);
    console.log(`액면 아이템(payout_items): ${itemCount}건`);
    console.log(`핀번호: ${pinCount}건`);
    console.log(`사진: ${imageCount}건`);
    console.log('완료.');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

run();
