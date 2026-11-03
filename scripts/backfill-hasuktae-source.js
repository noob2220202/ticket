// 이미 이전된 하석태(1.bokdreamticket.store, PORT 9020) 지급내역 261건에
// 실제 입금액/출금액(source_amount/source_type)을 채워넣습니다.
// id 생성 로직은 scripts/migrate-hasuktae-1017-1030.js와 완전히 동일해야
// 같은 행에 매칭됩니다(같은 순서로 seqByStamp를 재구성).
//
// 실행: PORT=9020 node scripts/backfill-hasuktae-source.js

if (String(process.env.PORT) !== '9020') {
  console.error('이 스크립트는 반드시 PORT=9020 로 실행해야 합니다 (1.bokdreamticket.store 전용 DB).');
  process.exit(1);
}

const dbMod = require('../server/db');
const ROWS = require('./data/hasuktae-1017-1030.json');

function run() {
  const seqByStamp = {};
  const update = dbMod.db.prepare('UPDATE payouts SET source_amount = ?, source_type = ? WHERE id = ?');

  let updated = 0;
  let missing = 0;

  ROWS.forEach((r) => {
    const stampKey = `${r.date.replace(/-/g, '')}${r.time.replace(/:/g, '')}`;
    seqByStamp[stampKey] = (seqByStamp[stampKey] || 0) + 1;
    const seq = seqByStamp[stampKey];
    const payoutId = `MIG-${stampKey}-${seq}`;
    const sourceType = r.kind === '출금' ? 'withdrawal' : 'deposit';

    const result = update.run(r.amount, sourceType, payoutId);
    if (result.changes > 0) updated += 1; else { missing += 1; console.warn('매칭 안 됨:', payoutId, r); }
  });

  console.log(`업데이트: ${updated}건`);
  if (missing) console.log(`매칭 실패: ${missing}건`);
  console.log('완료.');
}

run();
