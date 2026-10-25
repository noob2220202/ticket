// "이분식" 고객의 2026-07-01 지급내역을 서버 DB로 추가 이전하는 1회성 스크립트.
//
// 사용자 확인 사항:
//  - 목록 맨 앞/뒤의 "15:20 3,660,000"은 복사 중 겹친 중복 1건 -> 11건으로 처리.
//  - 입금액 × 1.05 를 1만원 단위로 반올림하면 합계가 39,460,000원이 되어
//    목표(정확히 3,950만원 = 39,500,000원)보다 40,000원 부족. 마지막 거래
//    (15:21, 입금 4,000,000원) 한 건에 그 차액(+40,000원)을 더해 총액을
//    정확히 39,500,000원으로 맞췄습니다.
//
// 실행: node scripts/migrate-leebunsik.js

const crypto = require('crypto');
const dbMod = require('../server/db');

const CUSTOMER_NAME = '이분식';
const BRAND = 'shinsegae';
const BRAND_NAME = '신세계상품권';
const DATE = '2026-07-01';
const DENOMS = [500000, 300000, 100000, 50000, 30000, 10000];

const DENOM_FILE = {
  500000: 'denom-500000.jpg',
  300000: 'denom-300000.jpg',
  100000: 'denom-100000.jpg',
  50000: 'denom-50000.jpg',
  30000: 'denom-30000.jpg',
  10000: 'denom-10000.jpg',
};

// 중복(맨 앞/뒤 15:20 3,660,000) 제거한 11건.
const DEPOSITS = [
  { time: '15:20:00', amount: 3660000 },
  { time: '15:19:00', amount: 2500000 },
  { time: '14:15:00', amount: 4000000 },
  { time: '14:13:00', amount: 2410000 },
  { time: '14:12:00', amount: 4000000 },
  { time: '14:11:00', amount: 3000000 },
  { time: '14:10:00', amount: 4000000 },
  { time: '15:26:00', amount: 4000000 },
  { time: '15:25:00', amount: 2500000 },
  { time: '15:24:00', amount: 3500000 },
  { time: '15:21:00', amount: 4000000 }, // 총액 보정 대상(+40,000원)
];

const RATE = 1.05;
const TARGET_TOTAL = 39500000;
const ADJUST_TIME = '15:21:00'; // 차액을 더할 거래

function kstToIso(dateStr, timeStr) {
  return new Date(`${dateStr}T${timeStr}+09:00`).toISOString();
}

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
  if (remaining !== 0) {
    throw new Error(`금액 ${amount}을 주어진 액면으로 정확히 나눌 수 없습니다(나머지 ${remaining}).`);
  }
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
  const already = dbMod.listPayouts().filter((p) => p.customer.name === CUSTOMER_NAME);
  if (already.length) {
    console.error(`이미 '${CUSTOMER_NAME}' 고객의 지급내역이 ${already.length}건 있습니다. 중복 삽입 방지를 위해 중단합니다.`);
    process.exit(1);
  }

  const usedPins = new Set(dbMod.existingPins());
  const generatePin = makePinGenerator(usedPins);

  let payoutTotal = 0;
  let depositTotal = 0;

  DEPOSITS.forEach((d, idx) => {
    let payoutAmount = roundToUnit(d.amount * RATE, 10000);
    if (d.time === ADJUST_TIME) payoutAmount += 40000; // 반올림 차액 보정
    payoutTotal += payoutAmount;
    depositTotal += d.amount;

    const createdAt = kstToIso(DATE, d.time);
    const stampKey = `${DATE.replace(/-/g, '')}${d.time.replace(/:/g, '')}`;
    const payoutId = `MIG-${stampKey}-${idx + 1}`;

    const items = breakdown(payoutAmount).map((it, i) => ({
      id: `${payoutId}-I${i + 1}`,
      denom: it.denom,
      qty: it.qty,
      pins: Array.from({ length: it.qty }, () => generatePin()),
    }));

    dbMod.insertPayoutWithItems({
      id: payoutId,
      orderNo: payoutId,
      createdAt,
      customer: { name: CUSTOMER_NAME },
      brand: BRAND,
      brandName: BRAND_NAME,
      memo: '',
      source: 'migration',
      items,
    });

    items.forEach((it) => {
      const filename = DENOM_FILE[it.denom];
      if (!filename) return;
      const imageId = `${it.id}-${crypto.randomUUID()}`;
      dbMod.addImage(it.id, imageId, filename, 'image/jpeg');
    });
  });

  console.log(`거래 건수: ${DEPOSITS.length}건`);
  console.log(`입금 총액: ${depositTotal.toLocaleString('ko-KR')}원`);
  console.log(`지급(상품권) 총액: ${payoutTotal.toLocaleString('ko-KR')}원 (목표 ${TARGET_TOTAL.toLocaleString('ko-KR')}원)`);
  if (payoutTotal !== TARGET_TOTAL) {
    console.error('경고: 목표 총액과 일치하지 않습니다!');
    process.exit(1);
  }
  console.log('완료.');
}

run();
