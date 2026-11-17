// bok-dreamticket.store(PORT 9025, 대표자 최봄) 지급내역 이전.
// 엑셀 "거래내역_과거부터최신"(2026-10-03~11-03)에서:
//  - "양정수"(계좌주 본인 입출금, 10/3 입금 300,000 / 11/3 출금 2,209,272로 잔액 0)
//  - "이자"(은행 이자 182원), "TWIZO.COM"(해외 결제서비스 출금) 제외 -> 199건 사용
//  - 시각이 "확인 필요"로 안 보이는 5건은 00:00으로 처리
//  - 공식은 하석태/김택현/정대원 건과 동일: 입금 = 실제입금액/0.97, 출금 = 실제출금액/0.95,
//    1만원 단위 반올림. 각 행 독립 거래.
//  - 핀번호는 12자리(4-4-4) 새 규칙.
//  - 사용자가 알려준 이름-계좌 목록을 매칭해 account_info로 저장.
//
// 실행: PORT=9025 node scripts/migrate-choibom-1003-1103.js

if (String(process.env.PORT) !== '9025') {
  console.error('이 스크립트는 반드시 PORT=9025 로 실행해야 합니다 (bok-dreamticket.store 전용 DB).');
  process.exit(1);
}

const crypto = require('crypto');
const dbMod = require('../server/db');
const { makePinGenerator } = require('./lib/pins');
const ROWS = require('./data/choibom-1003-1103.json');

const BRAND = 'shinsegae';
const BRAND_NAME = '신세계상품권';
const DENOMS = [500000, 300000, 100000, 50000, 30000, 10000];

// 이름 -> "은행 계좌번호" (사용자가 알려준 목록)
const ACCOUNT_TEXT = `
전인환 우체국 20178002067888
장영순 토스 100253112286
심용승 카뱅 3333228268900
장남수 하나 16289175076507
이해승 우리 1002354295737
김경락 국민 43920201120026
임석균 하나 71691048832607
강길순 토스 100089795141
김민수 국민 94290201341075
주복임 국민 07270204392618
박준규 카뱅 3333114601147
이형민 케이 100238308800
이준일 국민 26730104329972
이유림 하나 70991041940407
이승민 카뱅 3333170839603
김명국 카뱅 3333049528208
배문석 국민 28530200069516
이태하 수협 103010723521
이승철 우리 1002044501593
한스란 국민 019602 04 144588
송현석 국민 88260104127454
박이슬 우리 1002053987693
최정윤 케이 100218061814
정윤철 토스 100027251184
유수진 기업 35612457902012
진태성 농협 3561207521483
김진길 케이 100147556057
이광현 기업 49706076201018
오희찬 신한 110427739426
이현재 하나 59991030190107
오동길 케이 100162790239
전광선 우체국 10733402048016
이강진 국민 20860104053249
이재백 농협 3522009980933
이세민 신한 110617727651
이민후 카뱅 3333050488056
고득록 카뱅 3333126262318
장수민 카뱅 3333188289561
이학룡 농협 3020695456811
김태혁 카뱅 3333191669625
오로라 하나 74891035886007
박창일 농협 20705456403010
김영은 국민 94290200980655
배지현 케이 100196840028
이승호 광주 148121006355
함재현 신한 110468627144
최명락 농협 23713456277659
이원희 카뱅 3333188424299
김경인 농협 3025091845261
황보경애 카뱅 3333068551705
남용법 하나 19291036488507
박우정 국민 84150204340123
민들레 새마을 9002152314387
조정찬 토스 100016015860
이지혜 카뱅 3333166170160
김태양 기업 29905546901012
김상호 농협 3021410740361
홍영훈 농협 22102956161863
양진규 농협 3520902591663
김혜진 카뱅 3333249035377
이현용 카뱅 3333158802297
조윤숙 하나 01097980285807
김진곤 카뱅 3333187607906
이정현 케이 100107931202
`.trim();

const ACCOUNT_BY_NAME = {};
ACCOUNT_TEXT.split('\n').forEach((line) => {
  const parts = line.trim().split(/\s+/);
  if (parts.length < 2) return;
  const name = parts[0];
  const rest = parts.slice(1).join(' ');
  ACCOUNT_BY_NAME[name] = rest;
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

const DENOM_FILE = {
  500000: 'denom-500000.jpg', 300000: 'denom-300000.jpg', 100000: 'denom-100000.jpg',
  50000: 'denom-50000.jpg', 30000: 'denom-30000.jpg', 10000: 'denom-10000.jpg',
};

function run() {
  if (ROWS.length !== 199) {
    console.error(`예상한 행 수(199)와 다릅니다: ${ROWS.length}행.`);
    process.exit(1);
  }

  const already = dbMod.listPayouts();
  if (already.length) {
    console.error(`이미 지급내역이 ${already.length}건 있습니다. 중복 삽입 방지를 위해 중단합니다.`);
    process.exit(1);
  }

  const usedPins = new Set(dbMod.existingPins());
  const generatePin = makePinGenerator(usedPins);

  let totalIn = 0;
  let totalOut = 0;
  let payoutTotal = 0;
  let payoutCount = 0;
  let itemCount = 0;
  let matchedAccount = 0;
  const seqByStamp = {};

  ROWS.forEach((r) => {
    const type = r.kind === '출금' ? 'withdrawal' : 'deposit';
    const divisor = type === 'withdrawal' ? 0.95 : 0.97;
    const payoutAmount = roundToUnit(r.amount / divisor, 10000);
    const items = breakdown(payoutAmount);

    const stampKey = `${r.date.replace(/-/g, '')}${r.time.replace(':', '')}`;
    seqByStamp[stampKey] = (seqByStamp[stampKey] || 0) + 1;
    const seq = seqByStamp[stampKey];
    const payoutId = `MIG-${stampKey}-${seq}`;
    const memo = type === 'withdrawal' ? '매입(출금)' : '';
    const accountInfo = ACCOUNT_BY_NAME[r.name] || null;
    if (accountInfo) matchedAccount += 1;

    dbMod.insertPayoutWithItems({
      id: payoutId,
      orderNo: payoutId,
      createdAt: new Date(`${r.date}T${r.time}:00+09:00`).toISOString(),
      customer: { name: r.name },
      brand: BRAND,
      brandName: BRAND_NAME,
      memo,
      source: 'migration',
      sourceAmount: r.amount,
      sourceType: type,
      accountInfo,
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

    if (type === 'deposit') totalIn += r.amount; else totalOut += r.amount;
    payoutTotal += payoutAmount;
    payoutCount += 1;
    itemCount += items.length;
  });

  console.log(`거래 건수: ${payoutCount}건 (입금 ${ROWS.filter((r) => r.kind === '입금').length}건, 출금 ${ROWS.filter((r) => r.kind === '출금').length}건)`);
  console.log(`액면 아이템 수: ${itemCount}건`);
  console.log(`계좌정보 매칭: ${matchedAccount}건`);
  console.log(`실제 입금 합계: ${totalIn.toLocaleString('ko-KR')}원`);
  console.log(`실제 출금 합계: ${totalOut.toLocaleString('ko-KR')}원`);
  console.log(`지급(상품권) 총액: ${payoutTotal.toLocaleString('ko-KR')}원`);
  console.log('완료.');
}

run();
