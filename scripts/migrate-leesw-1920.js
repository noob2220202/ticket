// 이승우 계좌(bokdream1.store) 거래내역서 PDF에서 2026-10-19, 2026-10-20 입금 건을
// 지급내역으로 이전하는 1회성 스크립트. scripts/migrate-leesw-1021.js와 동일한 규칙:
//  - 출금(서정환/허근욱 등)은 전부 제외, 입금만 사용
//  - 같은 사람이 중간에 다른 사람 입금 없이 연속으로 입금하면 하나의 거래로 합산
//    (19일과 20일은 묶어서 하나의 연속된 입금 스트림으로 보고 병합 - 10/21은 이미
//    별도로 처리됐으므로 거기와는 연결하지 않음)
//  - 합산 입금액 × 1.03(수수료 3%), 1만원 단위 반올림
//  - 신세계상품권 50/30/10/5/3/1만원권 조합, 전화번호 공란, 메모 없음
//  - 대상 사이트: bokdream1.store (PORT 9019)
//
// 실행: PORT=9019 node scripts/migrate-leesw-1920.js

if (String(process.env.PORT) !== '9019') {
  console.error('이 스크립트는 반드시 PORT=9019 로 실행해야 합니다 (bokdream1.store 전용 DB).');
  process.exit(1);
}

const crypto = require('crypto');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const dbMod = require('../server/db');

const BRAND = 'shinsegae';
const BRAND_NAME = '신세계상품권';
const DENOMS = [500000, 300000, 100000, 50000, 30000, 10000];
const FEE_RATE = 0.03;
const PDF_PATH = '/root/.claude/uploads/454af72b-94b5-5664-b783-b15512e0c0c5/b98b811b-_______20261021141717_2.pdf';
const TEXT_PATH = path.join(__dirname, '..', '.tmp-statement-1920.txt');

// ---- 1) PDF -> 텍스트 추출 ----
execSync(`pdftotext -layout "${PDF_PATH}" "${TEXT_PATH}"`);
const lines = fs.readFileSync(TEXT_PATH, 'utf8').split('\n');
fs.unlinkSync(TEXT_PATH);

const rowRe = /^\s*(\d{4}\.\d{2}\.\d{2})\s+(\d{2}:\d{2}:\d{2})\s+(입금|출금)\s+(-?[\d,]+)\s+([\d,]+)\s+(\S+)\s+(\S+)\s*$/;
const rows = [];
lines.forEach((line) => {
  const m = line.match(rowRe);
  if (m) {
    rows.push({
      date: m[1], time: m[2], type: m[3],
      amount: Number(m[4].replace(/,/g, '')),
      memo: m[6],
    });
  }
});

// ---- 2) 2026.10.19 ~ 2026.10.20 입금만, PDF 원래 순서(최신순) 그대로 ----
const deposits = rows.filter((r) => (r.date === '2026.10.20' || r.date === '2026.10.19') && r.type === '입금');
if (deposits.length !== 937) {
  console.error(`예상한 입금 건수(937)와 다릅니다: ${deposits.length}건. PDF 추출 결과를 다시 확인하세요.`);
  process.exit(1);
}

// ---- 3) 연속된 동일 인물 입금을 하나의 거래로 합산 ----
const runs = [];
deposits.forEach((r) => {
  const last = runs[runs.length - 1];
  if (last && last.memo === r.memo) {
    last.items.push(r);
  } else {
    runs.push({ memo: r.memo, items: [r] });
  }
});

function roundToUnit(amount, unit) {
  return Math.round(amount / unit) * unit;
}

function breakdown(amount) {
  let remaining = amount;
  const items = [];
  for (const denom of DENOMS) {
    const qty = Math.floor(remaining / denom);
    if (qty > 0) {
      items.push({ denom, qty });
      remaining -= qty * denom;
    }
  }
  if (remaining !== 0) throw new Error(`금액 ${amount}을 액면으로 정확히 나눌 수 없습니다(나머지 ${remaining}).`);
  return items;
}

function makePinGenerator(usedPins) {
  const prefixes = ['9001', '9002', '9003', '9004', '9005', '9006', '9007', '9008', '9009'];
  return function generatePin() {
    let pin;
    do {
      const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
      let rest = '';
      for (let i = 0; i < 12; i += 1) rest += Math.floor(Math.random() * 10);
      pin = prefix + rest;
    } while (usedPins.has(pin));
    usedPins.add(pin);
    return pin;
  };
}

function run() {
  const already = dbMod.listPayouts().filter((p) => (p.orderNo || '').startsWith('MIG-20261020-') || (p.orderNo || '').startsWith('MIG-20261019-'));
  if (already.length) {
    console.error(`이미 이 스크립트로 이전된 지급내역이 ${already.length}건 있습니다. 중복 삽입 방지를 위해 중단합니다.`);
    process.exit(1);
  }

  const usedPins = new Set(dbMod.existingPins());
  const generatePin = makePinGenerator(usedPins);

  let totalDeposit = 0;
  let totalPayout = 0;
  let payoutCount = 0;
  let itemCount = 0;
  const seqByStamp = {};

  runs.forEach((runGroup) => {
    const depositSum = runGroup.items.reduce((s, it) => s + it.amount, 0);
    const payoutAmount = roundToUnit(depositSum * (1 + FEE_RATE), 10000);
    const items = breakdown(payoutAmount);

    // 대표 시각: 합산된 입금 중 가장 최근 것(배열의 첫 항목, PDF가 최신순이라).
    const repDate = runGroup.items[0].date.replace(/\./g, '');
    const repTime = runGroup.items[0].time;
    const stampKey = `${repDate}${repTime.replace(/:/g, '')}`;
    seqByStamp[stampKey] = (seqByStamp[stampKey] || 0) + 1;
    const seq = seqByStamp[stampKey];
    const dateDashed = runGroup.items[0].date.replace(/\./g, '-');
    const payoutId = `MIG-${repDate.slice(0, 8)}-${stampKey}-${seq}`;

    dbMod.insertPayoutWithItems({
      id: payoutId,
      orderNo: payoutId,
      createdAt: new Date(`${dateDashed}T${repTime}+09:00`).toISOString(),
      customer: { name: runGroup.memo },
      brand: BRAND,
      brandName: BRAND_NAME,
      memo: '',
      source: 'migration',
      items: items.map((it, idx) => ({
        id: `${payoutId}-I${idx + 1}`,
        denom: it.denom,
        qty: it.qty,
        pins: Array.from({ length: it.qty }, () => generatePin()),
      })),
    });

    totalDeposit += depositSum;
    totalPayout += payoutAmount;
    payoutCount += 1;
    itemCount += items.length;
  });

  console.log(`병합된 거래 건수: ${payoutCount}건 (원본 입금 ${deposits.length}건, 연속 병합 ${deposits.length - payoutCount}건)`);
  console.log(`액면 아이템 수: ${itemCount}건`);
  console.log(`입금 총액: ${totalDeposit.toLocaleString('ko-KR')}원`);
  console.log(`지급(상품권) 총액: ${totalPayout.toLocaleString('ko-KR')}원`);
  console.log('완료.');

  // ---- 4) 액면별 사진 첨부 ----
  const DENOM_FILE = {
    500000: 'denom-500000.jpg', 300000: 'denom-300000.jpg', 100000: 'denom-100000.jpg',
    50000: 'denom-50000.jpg', 30000: 'denom-30000.jpg', 10000: 'denom-10000.jpg',
  };
  const allItems = dbMod.db.prepare(`
    SELECT pi.id, pi.denom FROM payout_items pi
    JOIN payouts p ON p.id = pi.payout_id
    WHERE p.order_no LIKE 'MIG-20261020-%' OR p.order_no LIKE 'MIG-20261019-%'
  `).all();
  let imagesAdded = 0;
  allItems.forEach((it) => {
    const filename = DENOM_FILE[it.denom];
    if (!filename) return;
    const imageId = `${it.id}-${crypto.randomUUID()}`;
    dbMod.addImage(it.id, imageId, filename, 'image/jpeg');
    imagesAdded += 1;
  });
  console.log(`사진 연결: ${imagesAdded}건`);
}

run();
