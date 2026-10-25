// 정적 파일 서빙 + 지급내역(payouts) API 서버.
// 기존에는 `npx serve .` 로만 정적 파일을 서빙했는데, 지급내역을 브라우저
// localStorage/IndexedDB가 아니라 서버 쪽 SQLite DB에 실제로 저장하기 위해
// 이 서버를 추가했습니다. ecosystem.config.js의 각 사이트(포트)가 이 서버를
// 각각 띄우고, 모두 같은 data/payouts.db 파일을 공유합니다.
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { ZipArchive } = require('archiver');
const db = require('./db');
const { createDoc, renderPayoutPdf } = require('./pdf');

const ROOT = path.join(__dirname, '..');
const UPLOAD_DIR = path.join(ROOT, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// admin.html의 관리자 비밀번호와 동일합니다(js/admin.js 참고).
// 주의: 기존 코드 주석대로 이 비밀번호는 클라이언트 소스에도 그대로 노출되는
// 수준의 보호이며 실제 보안 수단이 아닙니다. 운영 단계에서는 서버 인증(세션/JWT 등)으로
// 반드시 교체해야 합니다. 지금은 "로컬에만 저장되던 걸 서버 DB로 옮긴다"는 범위에 맞춰
// 기존과 동일한 수준의 보호만 추가합니다.
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'bokdream2026';

const PORT = process.env.PORT || 9011;

const app = express();
app.use(express.json({ limit: '2mb' }));

function requireAdmin(req, res, next) {
  // <img src="...">는 커스텀 헤더를 보낼 수 없어서, 이미지 조회는 쿼리스트링
  // 토큰도 허용합니다(그 외 API는 헤더만 인정).
  const token = req.get('x-admin-token') || req.query.token;
  if (token !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: '인증이 필요합니다.' });
  }
  next();
}

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname || '') || '';
      cb(null, `${crypto.randomUUID()}${ext}`);
    },
  }),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) return cb(new Error('이미지 파일만 업로드할 수 있습니다.'));
    cb(null, true);
  },
});

// ---- 지급내역 API ----

app.get('/api/payouts', requireAdmin, (req, res) => {
  res.json(db.listPayouts());
});

// 지급 등록 폼은 한 번에 액면 하나(denom/qty)만 받습니다. 같은 거래(order_no)로
// 다시 등록하면 새 거래를 만들지 않고 기존 거래에 액면(아이템)만 추가합니다.
app.post('/api/payouts', requireAdmin, (req, res) => {
  const body = req.body || {};
  const name = (body.customerName || '').trim();
  const denom = Number(body.denom);
  const qty = Number(body.qty);
  const pins = Array.isArray(body.pins) ? body.pins.map((p) => String(p).trim()).filter(Boolean) : [];

  if (!name) return res.status(400).json({ error: '고객명을 입력해주세요.' });
  if (!denom || denom <= 0 || !qty || qty <= 0) {
    return res.status(400).json({ error: '액면가와 수량을 올바르게 입력해주세요.' });
  }

  const createdAt = body.createdAt ? new Date(body.createdAt).toISOString() : new Date().toISOString();

  let result;
  try {
    result = db.createOrAppendPayout({
      createdAt,
      orderNo: (body.orderNo || '').trim(),
      customerName: name,
      brand: body.brand || '',
      brandName: body.brandName || '',
      denom,
      qty,
      pins,
      memo: body.memo || '',
      source: 'admin',
    });
  } catch (e) {
    return res.status(400).json({ error: `저장 실패: ${e.message}` });
  }

  res.status(201).json({ payoutId: result.payoutId, itemId: result.itemId, merged: result.merged });
});

// 액면(아이템) 단위로 사진을 첨부합니다. 지급 등록 폼은 액면 하나만 입력하므로,
// 방금 POST /api/payouts 로 만든 itemId를 그대로 넘겨주면 됩니다.
app.post('/api/payout-items/:itemId/images', requireAdmin, upload.array('images', 10), (req, res) => {
  const { itemId } = req.params;
  const files = req.files || [];
  const imageIds = files.map((f) => {
    const imageId = `${itemId}-${crypto.randomUUID()}`;
    db.addImage(itemId, imageId, f.filename, f.mimetype);
    return imageId;
  });
  res.status(201).json({ images: imageIds });
});

app.get('/api/images/:imageId', requireAdmin, (req, res) => {
  const row = db.getImage(req.params.imageId);
  if (!row) return res.status(404).end();
  res.sendFile(path.join(UPLOAD_DIR, row.filename));
});

app.delete('/api/payouts/:id', requireAdmin, (req, res) => {
  const images = db.deletePayout(req.params.id);
  images.forEach((img) => {
    fs.unlink(path.join(UPLOAD_DIR, img.filename), () => {});
  });
  res.status(204).end();
});

// ---- 지급내역서 일괄 PDF(ZIP) 다운로드 ----
// 지급내역 탭의 검색창과 같은 로직(주문번호/고객명/상품권명/핀번호 매칭)으로
// 걸러낸 뒤, 각 건을 PDF로 만들어 ZIP 하나로 묶어 내려줍니다.

function matchesKeyword(p, keyword) {
  if (!keyword) return true;
  const pins = (p.items || []).flatMap((it) => it.pins || []);
  const hay = [p.orderNo, p.customer.name, p.brandName, ...pins].join(' ').toLowerCase();
  return hay.includes(keyword);
}

function pdfDocToBuffer(doc) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.end();
  });
}

app.get('/api/payouts/export-zip', requireAdmin, async (req, res) => {
  const keyword = String(req.query.keyword || '').trim().toLowerCase();
  const matched = db.listPayouts().filter((p) => matchesKeyword(p, keyword));

  if (!matched.length) {
    return res.status(404).json({ error: '조건에 맞는 지급내역이 없습니다.' });
  }

  const safeKeyword = (keyword || '전체').replace(/[^\w가-힣-]/g, '_');
  const dateStamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${encodeURIComponent(`지급내역서_${safeKeyword}_${dateStamp}`)}.zip"`,
  );

  const archive = new ZipArchive({ zlib: { level: 9 } });
  archive.on('error', (err) => {
    if (!res.headersSent) res.status(500);
    res.end();
    console.error('zip 생성 오류:', err);
  });
  archive.pipe(res);

  const usedNames = new Set();
  for (const payout of matched) {
    const doc = createDoc();
    renderPayoutPdf(doc, payout, (imageId) => {
      const row = db.getImage(imageId);
      return row ? path.join(UPLOAD_DIR, row.filename) : null;
    });
    const buffer = await pdfDocToBuffer(doc);

    let name = `지급내역서_${payout.id}.pdf`;
    while (usedNames.has(name)) name = `지급내역서_${payout.id}-${crypto.randomUUID().slice(0, 4)}.pdf`;
    usedNames.add(name);

    archive.append(buffer, { name });
  }

  archive.finalize();
});

// ---- 정적 파일 서빙 (기존 `serve .` 대체) ----
// `serve`는 확장자 없는 주소(/admin)를 자동으로 admin.html에 매칭해줬습니다.
// express.static의 extensions 옵션으로 같은 동작을 유지합니다.
app.use(express.static(ROOT, { extensions: ['html'] }));

app.listen(PORT, () => {
  console.log(`서버 실행 중: http://localhost:${PORT}`);
});
