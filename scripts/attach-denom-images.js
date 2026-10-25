// 신태희 고객 이전 지급내역(406행, source='migration')에 대해:
//  1) 메모를 전부 비우고
//  2) 액면가에 맞는 상품권 사진(uploads/denom-*.jpg)을 1장씩 연결합니다.
// 실행: node scripts/attach-denom-images.js

const crypto = require('crypto');
const dbMod = require('../server/db');
const db = dbMod.db;

const DENOM_FILE = {
  500000: 'denom-500000.jpg',
  300000: 'denom-300000.jpg',
  100000: 'denom-100000.jpg',
  50000: 'denom-50000.jpg',
  30000: 'denom-30000.jpg',
  10000: 'denom-10000.jpg',
};

function run() {
  const rows = db.prepare("SELECT id, denom FROM payouts WHERE source = 'migration'").all();
  if (!rows.length) {
    console.error("source='migration' 인 지급내역이 없습니다. 이미 처리됐거나 데이터가 없는지 확인하세요.");
    process.exit(1);
  }

  const clearMemo = db.prepare('UPDATE payouts SET memo = ? WHERE id = ?');
  const existingImages = db.prepare('SELECT COUNT(*) AS n FROM payout_images WHERE payout_id = ?');

  let memoCleared = 0;
  let imagesAdded = 0;
  let skippedNoFile = 0;

  rows.forEach((r) => {
    clearMemo.run('', r.id);
    memoCleared += 1;

    const already = existingImages.get(r.id).n;
    if (already > 0) return; // 이미 사진이 있는 건 건너뜀(중복 첨부 방지)

    const filename = DENOM_FILE[r.denom];
    if (!filename) {
      skippedNoFile += 1;
      console.warn(`액면 ${r.denom}에 대응하는 이미지가 없습니다 (${r.id})`);
      return;
    }

    const imageId = `${r.id}-${crypto.randomUUID()}`;
    dbMod.addImage(r.id, imageId, filename, 'image/jpeg');
    imagesAdded += 1;
  });

  console.log(`메모 삭제: ${memoCleared}건`);
  console.log(`사진 연결: ${imagesAdded}건`);
  if (skippedNoFile) console.log(`이미지 매칭 실패: ${skippedNoFile}건`);
  console.log('완료.');
}

run();
