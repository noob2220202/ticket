// 이승우 계좌(예금주 이승우, bokdream1.store 사이트)의 2026-10-21 거래내역서 PDF에서
// 입금 건만 뽑아 지급내역으로 이전하는 1회성 스크립트.
//
// 사용자 확인 사항:
//  - 출금(서정환/허근욱 등으로 나가는 음수 거래)은 전부 제외하고 입금만 사용.
//  - 같은 사람 이름이 "연속으로"(중간에 다른 사람 입금이 끼지 않고 바로 이어서)
//    여러 번 입금하면 하나의 거래로 합산. 중간에 다른 사람 입금이 끼면 따로 처리.
//    (예: 손승재 150,000 + 150,000 연속 입금 -> 300,000 하나로 합산)
//  - 수수료율 3%: 지급액 = 합산 입금액 × 1.03, 1만원 단위 반올림.
//  - 전화번호는 공란(입력 안 함).
//  - 신세계상품권 50/30/10/5/3/1만원권으로 액면 조합.
//  - 대상 사이트: bokdream1.store (PORT 9019) — 이 스크립트를 PORT=9019로 실행해야 합니다.
//
// 실행: PORT=9019 node scripts/migrate-leesw-1021.js

const crypto = require('crypto');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

if (String(process.env.PORT) !== '9019') {
  console.error('이 스크립트는 반드시 PORT=9019 로 실행해야 합니다 (bokdream1.store 전용 DB).');
  process.exit(1);
}

const dbMod = require('../server/db');

const BRAND = 'shinsegae';
const BRAND_NAME = '신세계상품권';
const DENOMS = [500000, 300000, 100000, 50000, 30000, 10000];
const FEE_RATE = 0.03;
const PDF_PATH = '/root/.claude/uploads/454af72b-94b5-5664-b783-b15512e0c0c5/b98b811b-_______20261021141717_2.pdf';
const TEXT_PATH = path.join(__dirname, '..', '.tmp-statement-1021.txt');

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

// ---- 2) 2026.10.21 입금만, PDF에 나온 순서(최신순) 그대로 ----
const deposits = rows.filter((r) => r.date === '2026.10.21' && r.type === '입금');
if (deposits.length !== 446) {
  console.error(`예상한 입금 건수(446)와 다릅니다: ${deposits.length}건. PDF 추출 결과를 다시 확인하세요.`);
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
  const already = dbMod.listPayouts().filter((p) => (p.orderNo || '').startsWith('MIG-20261021-'));
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
    const repTime = runGroup.items[0].time;
    const stampKey = `20261021${repTime.replace(/:/g, '')}`;
    seqByStamp[stampKey] = (seqByStamp[stampKey] || 0) + 1;
    const seq = seqByStamp[stampKey];
    const payoutId = `MIG-20261021-${stampKey}-${seq}`;

    const depositDesc = runGroup.items.length > 1
      ? runGroup.items.map((it) => it.amount.toLocaleString('ko-KR')).join('+') + '원'
      : `${depositSum.toLocaleString('ko-KR')}원`;

    dbMod.insertPayoutWithItems({
      id: payoutId,
      orderNo: payoutId,
      createdAt: new Date(`2026-10-21T${repTime}+09:00`).toISOString(),
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
}

run();
