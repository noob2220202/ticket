// 2.bokdreamticket.store(PORT 9021, 대표자 김택현) 지급내역 이전.
// 거래내역서(카카오뱅크, 2026.11.02~11.04)에서:
//  - "(주)에스에스에프앤" 출금(내부 정산성 송금, 하루 여러 번 반복)과
//    "이영재" 관련 거래는 전부 제외
//  - 나머지 입금/출금은 하석태 건과 동일한 공식 적용:
//    입금(상품권 판매대금) = 실제 입금액 / 0.97, 1만원 단위 반올림
//    출금(상품권 매입대금) = 실제 출금액 / 0.95, 1만원 단위 반올림
//  - 각 행을 독립된 거래로 처리(병합 없음)
//  - 핀번호는 새 규칙대로 12자리(4-4-4), 9001~9009 접두
//
// 실행: PORT=9021 node scripts/migrate-kimtaekhyun-1102-1104.js

if (String(process.env.PORT) !== '9021') {
  console.error('이 스크립트는 반드시 PORT=9021 로 실행해야 합니다 (2.bokdreamticket.store 전용 DB).');
  process.exit(1);
}

const crypto = require('crypto');
const dbMod = require('../server/db');
const { makePinGenerator } = require('./lib/pins');
const ROWS = require('./data/kimtaekhyun-1102-1104.json');

const BRAND = 'shinsegae';
const BRAND_NAME = '신세계상품권';
const DENOMS = [500000, 300000, 100000, 50000, 30000, 10000];

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

const DENOM_FILE = {
  500000: 'denom-500000.jpg', 300000: 'denom-300000.jpg', 100000: 'denom-100000.jpg',
  50000: 'denom-50000.jpg', 30000: 'denom-30000.jpg', 10000: 'denom-10000.jpg',
};

function run() {
  if (ROWS.length !== 89) {
    console.error(`예상한 행 수(89)와 다릅니다: ${ROWS.length}행.`);
    process.exit(1);
  }

  const already = dbMod.listPayouts().filter((p) => (p.orderNo || '').startsWith('MIG-20261102-') || (p.orderNo || '').startsWith('MIG-20261103-') || (p.orderNo || '').startsWith('MIG-20261104-'));
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
    const divisor = r.type === '출금' ? 0.95 : 0.97;
    const payoutAmount = roundToUnit(r.amount / divisor, 10000);
    const items = breakdown(payoutAmount);

    const stampKey = `${r.date.replace(/-/g, '')}${r.time.replace(/:/g, '')}`;
    seqByStamp[stampKey] = (seqByStamp[stampKey] || 0) + 1;
    const seq = seqByStamp[stampKey];
    const payoutId = `MIG-${stampKey}-${seq}`;
    const sourceType = r.type === '출금' ? 'withdrawal' : 'deposit';
    const memo = r.type === '출금' ? '매입(출금)' : '';

    dbMod.insertPayoutWithItems({
      id: payoutId,
      orderNo: payoutId,
      createdAt: new Date(`${r.date}T${r.time}+09:00`).toISOString(),
      customer: { name: r.memo },
      brand: BRAND,
      brandName: BRAND_NAME,
      memo,
      source: 'migration',
      sourceAmount: r.amount,
      sourceType,
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

    if (r.type === '입금') totalIn += r.amount; else totalOut += r.amount;
    payoutTotal += payoutAmount;
    payoutCount += 1;
    itemCount += items.length;
  });

  console.log(`거래 건수: ${payoutCount}건 (입금 ${ROWS.filter((r) => r.type === '입금').length}건, 출금 ${ROWS.filter((r) => r.type === '출금').length}건)`);
  console.log(`액면 아이템 수: ${itemCount}건`);
  console.log(`실제 입금 합계: ${totalIn.toLocaleString('ko-KR')}원`);
  console.log(`실제 출금 합계: ${totalOut.toLocaleString('ko-KR')}원`);
  console.log(`지급(상품권) 총액: ${payoutTotal.toLocaleString('ko-KR')}원`);
  console.log('완료.');
}

run();
