// 6.bokdreamticket.store(PORT 9024, 대표자 정대원) 지급내역 이전.
// 두 소스를 하나로 합쳐서 처리합니다:
//  - 출금 내역(2026-11-12~11-14, 텍스트로 전달됨): "(주)엔클루"(내부 정산성,
//    1회성이지만 회사명이라 제외) 제외하고 35건
//  - 입금 내역(우리은행 "예금 거래 실적 증명서" PDF, 2026-11-11~11-13):
//    차장근/최영희("최윤희"로 말씀하셨으나 파일에는 최영희만 있어 확인 후 제외)/
//    박이수/이해헌(사용자가 지정한 제외 대상), 그리고 예금주 본인(정대원)과
//    안진형(사용자 확인 후 제외) 빼고 34건
//  - 공식은 하석태/김택현 건과 동일: 입금 = 실제입금액 / 0.97, 출금 = 실제출금액 / 0.95,
//    1만원 단위 반올림. 각 행 독립 거래(병합 없음). 핀번호는 새 규칙 12자리(4-4-4).
//
// 실행: PORT=9024 node scripts/migrate-jeongdaewon-1111-1114.js

if (String(process.env.PORT) !== '9024') {
  console.error('이 스크립트는 반드시 PORT=9024 로 실행해야 합니다 (6.bokdreamticket.store 전용 DB).');
  process.exit(1);
}

const crypto = require('crypto');
const dbMod = require('../server/db');
const { makePinGenerator } = require('./lib/pins');

const BRAND = 'shinsegae';
const BRAND_NAME = '신세계상품권';
const DENOMS = [500000, 300000, 100000, 50000, 30000, 10000];

// ---- 출금 내역 (35건, (주)엔클루 제외) ----
const WITHDRAWALS = [
  ['2026-11-12', '17:45:15', '정희선', 4000000],
  ['2026-11-12', '17:46:25', '정희선', 3800000],
  ['2026-11-12', '17:47:36', '정희선', 2200000],
  ['2026-11-12', '17:49:14', '정희선', 2001212],
  ['2026-11-12', '17:51:27', '이수진', 3438262],
  ['2026-11-12', '18:07:53', '황지혜', 484000],
  ['2026-11-12', '19:24:11', '박경진', 40962],
  ['2026-11-12', '21:01:17', '유재호', 695000],
  ['2026-11-12', '22:37:24', '정의천', 100000],

  ['2026-11-13', '09:12:40', '김준임', 4000000],
  ['2026-11-13', '09:13:55', '김준임', 3700000],
  ['2026-11-13', '09:14:39', '김준임', 2300000],
  ['2026-11-13', '10:07:17', '김나영', 4000000],
  ['2026-11-13', '10:08:02', '김나영', 3200000],
  ['2026-11-13', '10:08:53', '김나영', 2800000],
  ['2026-11-13', '10:13:25', '김용규', 4000000],
  ['2026-11-13', '10:14:59', '김용규', 4000000],
  ['2026-11-13', '10:43:29', '계윤희', 100000],
  ['2026-11-13', '10:55:45', '최용우', 2000000],
  ['2026-11-13', '11:21:24', '이상무', 5900000],
  ['2026-11-13', '12:34:04', '이연정', 639742],
  ['2026-11-13', '14:28:39', '강형종', 4970000],
  ['2026-11-13', '15:24:07', '계윤희', 80000],
  ['2026-11-13', '20:58:51', '전성혜', 3000000],
  ['2026-11-13', '21:07:42', 'LIZHEZHU', 50000],

  ['2026-11-14', '00:17:52', '이해헌', 90000],
  ['2026-11-14', '00:34:23', '홍종성', 2370000],
  ['2026-11-14', '01:00:25', '신용호', 20000],
  ['2026-11-14', '01:36:47', '이강영', 92378],
  ['2026-11-14', '02:14:31', '김정희', 4000000],
  ['2026-11-14', '02:15:30', '김정희', 3600000],
  ['2026-11-14', '02:16:31', '김정희', 2400000],
  ['2026-11-14', '02:29:55', '강지숙', 1385134],
  ['2026-11-14', '13:45:08', '윤성길', 197188],
  ['2026-11-14', '13:46:14', '계윤희', 1000000],
];

// ---- 입금 내역 (34건, 차장근/최영희/박이수/이해헌/정대원 본인/안진형 제외) ----
const DEPOSITS = [
  ['2026-11-13', '16:25:04', '조은진', 1000000],
  ['2026-11-13', '15:32:39', '김두례', 1000000],
  ['2026-11-13', '12:31:10', '송애리', 4500000],
  ['2026-11-13', '11:14:20', '신용호', 100000],
  ['2026-11-13', '10:49:05', '이연정', 400000],
  ['2026-11-13', '10:37:34', '김종화', 1000000],
  ['2026-11-13', '09:40:33', '김나영', 2800000],
  ['2026-11-13', '09:40:04', '김나영', 3200000],
  ['2026-11-13', '09:39:39', '김나영', 4000000],
  ['2026-11-13', '00:23:16', '윤성길', 2000000],

  ['2026-11-12', '22:30:32', '신용호', 100000],
  ['2026-11-12', '22:10:39', '신준홍', 550000],
  ['2026-11-12', '21:47:43', '신용호', 50000],
  ['2026-11-12', '21:22:08', '양석창', 1100000],
  ['2026-11-12', '19:09:25', 'LIZHEZHU', 2000000],
  ['2026-11-12', '18:54:08', '박경진', 100000],
  ['2026-11-12', '18:18:14', '김형수', 2000000],
  ['2026-11-12', '18:17:10', '김형수', 3000000],
  ['2026-11-12', '18:14:51', '강형종', 2000000],
  ['2026-11-12', '18:06:08', '강지숙', 4000000],
  ['2026-11-12', '14:41:42', '오지향', 1000000],
  ['2026-11-12', '12:12:38', '조은진', 2000000],
  ['2026-11-12', '11:10:54', '이연정', 300000],
  ['2026-11-12', '09:19:15', '임재준', 1400000],
  ['2026-11-12', '09:19:03', '임재준', 2600000],
  ['2026-11-12', '09:19:01', '신용호', 400000],
  ['2026-11-12', '09:18:49', '임재준', 4000000],
  ['2026-11-12', '02:05:11', '김춘수', 500000],
  ['2026-11-12', '01:45:09', '강지숙', 4000000],
  ['2026-11-12', '00:06:35', '임재준', 3000000],

  ['2026-11-11', '23:57:15', '정희선', 2400000],
  ['2026-11-11', '23:55:39', '정희선', 2600000],
  ['2026-11-11', '23:00:01', '이강영', 458000],
  ['2026-11-11', '20:55:21', '신현미', 400000],
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

const DENOM_FILE = {
  500000: 'denom-500000.jpg', 300000: 'denom-300000.jpg', 100000: 'denom-100000.jpg',
  50000: 'denom-50000.jpg', 30000: 'denom-30000.jpg', 10000: 'denom-10000.jpg',
};

function run() {
  const already = dbMod.listPayouts().filter((p) => (p.orderNo || '').startsWith('MIG-20261111-') || (p.orderNo || '').startsWith('MIG-20261112-') || (p.orderNo || '').startsWith('MIG-20261113-') || (p.orderNo || '').startsWith('MIG-20261114-'));
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
