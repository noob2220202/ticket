// bokdream1.store(이승우, PORT 9019) 지급내역 전체 아이템에 액면가별 상품권 사진을
// 연결합니다. (scripts/attach-denom-images.js와 같은 작업을 9019 DB에 대해 수행)
// 실행: PORT=9019 node scripts/attach-denom-images-9019.js

if (String(process.env.PORT) !== '9019') {
  console.error('이 스크립트는 반드시 PORT=9019 로 실행해야 합니다 (bokdream1.store 전용 DB).');
  process.exit(1);
}

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
  const items = db.prepare('SELECT id, denom FROM payout_items').all();
  if (!items.length) {
    console.error('payout_items가 없습니다.');
    process.exit(1);
  }

  const existingImages = db.prepare('SELECT COUNT(*) AS n FROM payout_images WHERE item_id = ?');
  let imagesAdded = 0;
  let skipped = 0;
  let skippedNoFile = 0;

  items.forEach((it) => {
    const already = existingImages.get(it.id).n;
    if (already > 0) { skipped += 1; return; }

    const filename = DENOM_FILE[it.denom];
    if (!filename) {
      skippedNoFile += 1;
      console.warn(`액면 ${it.denom}에 대응하는 이미지가 없습니다 (${it.id})`);
      return;
    }

    const imageId = `${it.id}-${crypto.randomUUID()}`;
    dbMod.addImage(it.id, imageId, filename, 'image/jpeg');
    imagesAdded += 1;
  });

  console.log(`아이템 수: ${items.length}건`);
  console.log(`사진 연결: ${imagesAdded}건`);
  if (skipped) console.log(`이미 사진 있어 건너뜀: ${skipped}건`);
  if (skippedNoFile) console.log(`이미지 매칭 실패: ${skippedNoFile}건`);
  console.log('완료.');
}

run();
