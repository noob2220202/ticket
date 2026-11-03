// 1.bokdreamticket.store(PORT 9020, 대표자 하석태) 지급내역 이전.
// 엑셀 파일(복드림상품권_하석태 거래내역 2026-10-17~10-30)의 "계산 기준" 시트에
// 명시된 공식을 그대로 썼습니다:
//   입금(상품권 판매대금) = 실제 입금액 / 0.97, 1만원 단위 반올림
//   출금(상품권 매입대금) = 실제 출금액 / 0.95, 1만원 단위 반올림
// "전체 거래내역" 시트의 "계산 액면가" 컬럼이 이미 이 공식으로 계산돼 있었고,
// 261행 전부 공식과 정확히 일치하는 것을 확인(scripts/data/hasuktae-1017-1030.json
// 생성 시 검증 완료)했으므로, 그 값을 그대로 지급액으로 사용합니다.
// 입금/출금 모두 각 행을 독립된 거래로 처리합니다(병합 없음 — 같은 시각에
// 여러 건이 있어도 엑셀이 이미 행 단위로 따로 계산해뒀기 때문).
//
// 실행: PORT=9020 node scripts/migrate-hasuktae-1017-1030.js

if (String(process.env.PORT) !== '9020') {
  console.error('이 스크립트는 반드시 PORT=9020 로 실행해야 합니다 (1.bokdreamticket.store 전용 DB).');
  process.exit(1);
}

const crypto = require('crypto');
const dbMod = require('../server/db');
const ROWS = require('./data/hasuktae-1017-1030.json');

const BRAND = 'shinsegae';
const BRAND_NAME = '신세계상품권';
const DENOMS = [500000, 300000, 100000, 50000, 30000, 10000];

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
  if (ROWS.length !== 261) {
    console.error(`예상한 행 수(261)와 다릅니다: ${ROWS.length}행.`);
    process.exit(1);
  }

  const already = dbMod.listPayouts().filter((p) => (p.orderNo || '').startsWith('MIG-20261017-') || (p.orderNo || '').startsWith('MIG-20261030-'));
  if (already.length) {
    console.error(`이미 이전된 지급내역이 ${already.length}건 있습니다. 중복 삽입 방지를 위해 중단합니다.`);
    process.exit(1);
  }

  const usedPins = new Set(dbMod.existingPins());
  const generatePin = makePinGenerator(usedPins);

  let totalIn = 0;
  let totalOut = 0;
  let payoutTotal = 0;
  let payoutCount = 0;
  let itemCount = 0;
  const seqByStamp = {};

  ROWS.forEach((r) => {
    const items = breakdown(r.payout);
    const stampKey = `${r.date.replace(/-/g, '')}${r.time.replace(/:/g, '')}`;
    seqByStamp[stampKey] = (seqByStamp[stampKey] || 0) + 1;
    const seq = seqByStamp[stampKey];
    const payoutId = `MIG-${stampKey}-${seq}`;
    const memo = r.kind === '출금' ? '매입(출금)' : '';

    dbMod.insertPayoutWithItems({
      id: payoutId,
      orderNo: payoutId,
      createdAt: new Date(`${r.date}T${r.time}+09:00`).toISOString(),
      customer: { name: r.name },
      brand: BRAND,
      brandName: BRAND_NAME,
      memo,
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

    if (r.kind === '입금') totalIn += r.amount; else totalOut += r.amount;
    payoutTotal += r.payout;
    payoutCount += 1;
    itemCount += items.length;
  });

  console.log(`거래 건수: ${payoutCount}건 (입금 ${ROWS.filter((r) => r.kind === '입금').length}건, 출금 ${ROWS.filter((r) => r.kind === '출금').length}건)`);
  console.log(`액면 아이템 수: ${itemCount}건`);
  console.log(`실제 입금 합계: ${totalIn.toLocaleString('ko-KR')}원`);
  console.log(`실제 출금 합계: ${totalOut.toLocaleString('ko-KR')}원`);
  console.log(`지급(상품권) 총액: ${payoutTotal.toLocaleString('ko-KR')}원`);
  console.log('완료.');
}

run();
