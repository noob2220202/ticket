// 복드림.store(PORT 9016) 문부건 고객의 2026-06-18 지급내역 이전.
// 기존 건들과 같은 규칙: 백만원 단위(400 -> 4,000,000원), 수수료 3%,
// 같은 시각 반복돼도 각 줄을 별개 거래로 처리.
//
// 실행: PORT=9016 node scripts/migrate-moonbugeon-0618.js

if (String(process.env.PORT) !== '9016') {
  console.error('이 스크립트는 반드시 PORT=9016 로 실행해야 합니다 (복드림.store 전용 DB).');
  process.exit(1);
}

const crypto = require('crypto');
const dbMod = require('../server/db');

const CUSTOMER_NAME = '문부건';
const BRAND = 'shinsegae';
const BRAND_NAME = '신세계상품권';
const FEE_RATE = 0.03;
const DENOMS = [500000, 300000, 100000, 50000, 30000, 10000];
const DATE = '2026-06-18';

// [time, 백만원단위금액]
const DEPOSITS = [
  ['18:45', 400], ['18:45', 390], ['18:45', 380], ['18:45', 370], ['18:45', 50],
];

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

const DENOM_FILE = {
  500000: 'denom-500000.jpg', 300000: 'denom-300000.jpg', 100000: 'denom-100000.jpg',
  50000: 'denom-50000.jpg', 30000: 'denom-30000.jpg', 10000: 'denom-10000.jpg',
};

function run() {
  const stampPrefix = `MIG-${DATE.replace(/-/g, '')}`;
  const already = dbMod.listPayouts().filter((p) => (p.orderNo || '').startsWith(stampPrefix) && p.customer.name === CUSTOMER_NAME);
  if (already.length) {
    console.error(`이미 ${DATE} '${CUSTOMER_NAME}' 지급내역이 ${already.length}건 있습니다. 중복 삽입 방지를 위해 중단합니다.`);
    process.exit(1);
  }

  const usedPins = new Set(dbMod.existingPins());
  const generatePin = makePinGenerator(usedPins);

  let totalDeposit = 0;
  let totalPayout = 0;
  let payoutCount = 0;
  let itemCount = 0;
  const seqByStamp = {};

  DEPOSITS.forEach(([time, amountMan]) => {
    const depositAmount = amountMan * 10000;
    const payoutAmount = roundToUnit(depositAmount * (1 + FEE_RATE), 10000);
    const items = breakdown(payoutAmount);

    const stampKey = `${DATE.replace(/-/g, '')}${time.replace(':', '')}`;
    seqByStamp[stampKey] = (seqByStamp[stampKey] || 0) + 1;
    const seq = seqByStamp[stampKey];
    const payoutId = `MIG-${stampKey}-${seq}`;

    dbMod.insertPayoutWithItems({
      id: payoutId,
      orderNo: payoutId,
      createdAt: new Date(`${DATE}T${time}:00+09:00`).toISOString(),
      customer: { name: CUSTOMER_NAME },
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

    items.forEach((it, idx) => {
      const itemId = `${payoutId}-I${idx + 1}`;
      const filename = DENOM_FILE[it.denom];
      if (!filename) return;
      const imageId = `${itemId}-${crypto.randomUUID()}`;
      dbMod.addImage(itemId, imageId, filename, 'image/jpeg');
    });

    totalDeposit += depositAmount;
    totalPayout += payoutAmount;
    payoutCount += 1;
    itemCount += items.length;
  });

  console.log(`거래 건수: ${payoutCount}건`);
  console.log(`액면 아이템 수: ${itemCount}건`);
  console.log(`입금 총액: ${totalDeposit.toLocaleString('ko-KR')}원`);
  console.log(`지급(상품권) 총액: ${totalPayout.toLocaleString('ko-KR')}원`);
  console.log('완료.');
}

run();
