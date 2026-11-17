// 사이트 13(PORT 9026, 대표자 김민정 010-6629-3110, bokdream-ticket.shop) 지급내역 이전.
// 소스: 거래내역 엑셀(계좌 130202-04-128926, 2026.10.04~11.04), 정리본은
// scripts/data/kimminjeong-1004-1104.json ([날짜, 시각, 이름, 금액, 유형]).
// 제외: 예금주 본인(김민정 입금 13건, 제주김민정 출금 1건), 취소/취소된거래 2쌍,
//  1원 인증(KPS8733/KPS7170), 통신요금·지로·FBS·입출통지 수수료,
//  (주)앤알커뮤니케이, 010PAY충전계좌, HANPASS, CHINGU(서비스 결제성).
// 출금 받는분 앞의 은행 약칭(농협/카뱅/새마/신협/기업/하나/경남/우체/신한/부산/우리/케이)은
// 떼고 이름만 씁니다. 공식: 입금 ÷0.97, 출금 ÷0.95, 1만원 단위 반올림, 각 행 독립.
//
// 실행: PORT=9026 node scripts/migrate-kimminjeong-1004-1104.js

if (String(process.env.PORT) !== '9026') {
  console.error('이 스크립트는 반드시 PORT=9026 로 실행해야 합니다 (김민정 사이트 전용 DB).');
  process.exit(1);
}

const crypto = require('crypto');
const dbMod = require('../server/db');
const { makePinGenerator } = require('./lib/pins');

const BRAND = 'shinsegae';
const BRAND_NAME = '신세계상품권';
const DENOMS = [500000, 300000, 100000, 50000, 30000, 10000];

const ROWS = require('./data/kimminjeong-1004-1104.json');
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
