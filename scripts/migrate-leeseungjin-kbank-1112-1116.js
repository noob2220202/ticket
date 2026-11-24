// no1.bokdream.store(PORT 9027, 대표자 이승진) 지급내역 정리 2차.
// 1) 사용자 지시로 기존(KB 국민 docx) 이전분 중 고봉희·김다온·곽주영·우주최강유진이(이유진) 삭제.
// 2) 케이뱅크 거래내역증명서(100-108-985005, 2026.11.12~11.16, 222행, 잔액 연속 확인)에서
//    박찬희·장성식·배정윤·정세빈 출금(구매내역서, ÷0.95)과
//    "실시간이체"(제주은행) 입금 11건(지급내역서, ÷0.97, 별도 분류)을 추가.
//    제외: 이승진 본인, 박영수·채종건·여인우·이유진·곽주영(사용자 지정), 카카오페이.
//    박고윤·이희승은 원본에 없음.
// 실행: PORT=9027 node scripts/migrate-leeseungjin-kbank-1112-1116.js

if (String(process.env.PORT) !== '9027') {
  console.error('이 스크립트는 반드시 PORT=9027 로 실행해야 합니다.');
  process.exit(1);
}

const crypto = require('crypto');
const dbMod = require('../server/db');
const { makePinGenerator } = require('./lib/pins');

const BRAND = 'shinsegae';
const BRAND_NAME = '신세계상품권';
const DENOMS = [500000, 300000, 100000, 50000, 30000, 10000];
const DENOM_FILE = {
  500000: 'denom-500000.jpg', 300000: 'denom-300000.jpg', 100000: 'denom-100000.jpg',
  50000: 'denom-50000.jpg', 30000: 'denom-30000.jpg', 10000: 'denom-10000.jpg',
};
const REMOVE_NAMES = new Set(['고봉희', '김다온', '곽주영', '우주최강유진이', '이유진']);
const ROWS = require('./data/leeseungjin-kbank-1112-1116.json');

function breakdown(amount) {
  let remaining = amount;
  const items = [];
  for (const denom of DENOMS) {
    const qty = Math.floor(remaining / denom);
    if (qty > 0) { items.push({ denom, qty }); remaining -= qty * denom; }
  }
  if (remaining !== 0) throw new Error(`금액 ${amount} 분해 실패`);
  return items;
}

const existing = dbMod.listPayouts();
if (existing.some((p) => p.customer.name === '박찬희' || p.customer.name === '실시간이체')) {
  console.error('이미 케이뱅크 건이 들어가 있습니다. 중단합니다.');
  process.exit(1);
}

let removed = 0;
for (const p of existing) {
  if (REMOVE_NAMES.has(p.customer.name)) { dbMod.deletePayout(p.id); removed += 1; }
}

const usedIds = new Set(dbMod.listPayouts().map((p) => p.id));
const generatePin = makePinGenerator(new Set(dbMod.existingPins()));
let added = 0;
let total = 0;
for (const [date, time, name, amount, type, accountInfo, group] of ROWS) {
  const divisor = type === 'withdrawal' ? 0.95 : 0.97;
  const payoutAmount = Math.round(amount / divisor / 10000) * 10000;
  const items = breakdown(payoutAmount);
  const stamp = `${date.replace(/-/g, '')}${time.replace(/:/g, '')}`;
  let seq = 1;
  while (usedIds.has(`MIG-${stamp}-${seq}`)) seq += 1;
  const id = `MIG-${stamp}-${seq}`;
  usedIds.add(id);
  const memo = type === 'withdrawal' ? '매입(출금)' : '';
  dbMod.insertPayoutWithItems({
    id, orderNo: id,
    createdAt: new Date(`${date}T${time}+09:00`).toISOString(),
    customer: { name },
    brand: BRAND, brandName: BRAND_NAME, memo, source: 'migration',
    sourceAmount: amount, sourceType: type, accountInfo: accountInfo || null,
    items: items.map((it, idx) => ({
      id: `${id}-I${idx + 1}`, denom: it.denom, qty: it.qty,
      pins: Array.from({ length: it.qty }, () => generatePin()),
    })),
  });
  items.forEach((it, idx) => {
    const itemId = `${id}-I${idx + 1}`;
    dbMod.addImage(itemId, `${itemId}-${crypto.randomUUID()}`, DENOM_FILE[it.denom], 'image/jpeg');
  });
  added += 1;
  total += payoutAmount;
}
console.log(`삭제 ${removed}건, 추가 ${added}건, 추가분 상품권 총액 ${total.toLocaleString('ko-KR')}원, 현재 총 ${dbMod.listPayouts().length}건`);
