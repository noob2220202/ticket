// 사이트 15(PORT 9029, bok-dream.store, 대표자 정연재 010-7560-8253) 지급내역 이전.
// 소스: 카카오뱅크 거래내역(****-**-***7344, 2026.10.12~11.19, 실제 거래 10.24~11.19 596행,
// 잔액 연속성 확인 완료). 정리본은 scripts/data/jeongyeonjae-1024-1119.json.
// 제외: 예금주 본인(정연재), 예금이자(0원), 0원이 되는 소액(김수현 3,000 / 박현준 2,990),
//  심윤희 200,000원 입금 후 24분 뒤 같은 금액 반환(되돌림 쌍).
// '정기원(명덕구운몽)', '김연호(장안건설)'은 괄호 앞 이름만 씁니다.
// 공식: 입금 ÷0.97, 출금 ÷0.95, 1만원 단위 반올림, 각 행 독립.
//
// 실행: PORT=9029 node scripts/migrate-jeongyeonjae-1024-1119.js

if (String(process.env.PORT) !== '9029') {
  console.error('이 스크립트는 반드시 PORT=9029 로 실행해야 합니다 (bok-dream.store 전용 DB).');
  process.exit(1);
}

const crypto = require('crypto');
const dbMod = require('../server/db');
const { makePinGenerator } = require('./lib/pins');

const BRAND = 'shinsegae';
const BRAND_NAME = '신세계상품권';
const DENOMS = [500000, 300000, 100000, 50000, 30000, 10000];

const ROWS = require('./data/jeongyeonjae-1024-1119.json');
const WITHDRAWALS = ROWS.filter((r) => r[4] === 'withdrawal').map((r) => r.slice(0, 4));
const DEPOSITS = ROWS.filter((r) => r[4] === 'deposit').map((r) => r.slice(0, 4));

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
  const already = dbMod.listPayouts().filter((p) => (p.orderNo || '').startsWith('MIG-'));
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

  function process(rows, type) {
    const divisor = type === 'withdrawal' ? 0.95 : 0.97;
    rows.forEach(([date, time, name, amount]) => {
      const payoutAmount = roundToUnit(amount / divisor, 10000);
      const items = breakdown(payoutAmount);

      const stampKey = `${date.replace(/-/g, '')}${time.replace(/:/g, '')}`;
      seqByStamp[stampKey] = (seqByStamp[stampKey] || 0) + 1;
      const seq = seqByStamp[stampKey];
      const payoutId = `MIG-${stampKey}-${seq}`;
      const memo = type === 'withdrawal' ? '매입(출금)' : '';

      dbMod.insertPayoutWithItems({
        id: payoutId,
        orderNo: payoutId,
        createdAt: new Date(`${date}T${time}+09:00`).toISOString(),
        customer: { name },
        brand: BRAND,
        brandName: BRAND_NAME,
        memo,
        source: 'migration',
        sourceAmount: amount,
        sourceType: type,
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

      if (type === 'deposit') totalIn += amount; else totalOut += amount;
      payoutTotal += payoutAmount;
      payoutCount += 1;
      itemCount += items.length;
    });
  }

  process(WITHDRAWALS, 'withdrawal');
  process(DEPOSITS, 'deposit');

  console.log(`거래 건수: ${payoutCount}건 (입금 ${DEPOSITS.length}건, 출금 ${WITHDRAWALS.length}건)`);
  console.log(`액면 아이템 수: ${itemCount}건`);
  console.log(`실제 입금 합계: ${totalIn.toLocaleString('ko-KR')}원`);
  console.log(`실제 출금 합계: ${totalOut.toLocaleString('ko-KR')}원`);
  console.log(`지급(상품권) 총액: ${payoutTotal.toLocaleString('ko-KR')}원`);
  console.log('완료.');
}

run();
