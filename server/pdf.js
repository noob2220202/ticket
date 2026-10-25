// 지급내역서(상세 화면과 같은 내용)를 서버에서 바로 PDF로 만듭니다.
// 브라우저 "인쇄해서 PDF 저장"과 달리, 헤드리스 브라우저 없이 pdfkit(순수 JS,
// 네이티브 빌드 불필요)만으로 만들어서 운영 서버에 무거운 Chromium을 설치할
// 필요가 없습니다. 한글 표시를 위해 Pretendard 폰트를 내장합니다.
const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

const FONT_REGULAR = path.join(__dirname, 'fonts', 'Pretendard-Regular.otf');
const FONT_BOLD = path.join(__dirname, 'fonts', 'Pretendard-Bold.otf');

const BIZ_NAME = '복드림 상품권';
const BIZ_REG_NO = '사업자등록번호 623-70-00295';
const BIZ_ADDR = '서울특별시 성동구 천호대로 430, 1층 103호(용답동)';

function won(n) {
  return n.toLocaleString('ko-KR') + '원';
}

function fmtDate(iso) {
  const d = new Date(iso);
  return d.toLocaleString('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

function payoutTotal(p) {
  return p.items.reduce((s, it) => s + it.denom * it.qty, 0);
}

function ensureSpace(doc, needed) {
  const bottom = doc.page.height - doc.page.margins.bottom;
  if (doc.y + needed > bottom) doc.addPage();
}

function sectionTitle(doc, title) {
  ensureSpace(doc, 30);
  doc.font(FONT_BOLD).fontSize(11).fillColor('#1a1a2e').text(title);
  doc.moveDown(0.4);
}

// 주문번호 같은 긴 값은 좁은 2단 컬럼에 넣으면 줄바꿈 높이를 예측하기 어려워
// 다음 섹션과 겹치기 쉽습니다. 한 줄씩 세로로 쌓아서(flowing API) pdfkit이
// 줄바꿈/페이지 전환을 알아서 처리하도록 둡니다.
function infoLine(doc, label, value) {
  ensureSpace(doc, 24);
  doc.font(FONT_REGULAR).fontSize(8).fillColor('#888').text(label);
  doc.font(FONT_REGULAR).fontSize(10).fillColor('#1a1a2e').text(value || '-');
  doc.moveDown(0.4);
}

function itemsTable(doc, items) {
  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  const cols = [
    { label: '상품권', w: 0.4, align: 'left' },
    { label: '액면가', w: 0.2, align: 'right' },
    { label: '수량', w: 0.15, align: 'right' },
    { label: '액면 합계', w: 0.25, align: 'right' },
  ];
  const totalWidth = right - left;

  ensureSpace(doc, 26);
  let x = left;
  const headerY = doc.y;
  doc.font(FONT_BOLD).fontSize(9).fillColor('#555');
  cols.forEach((c) => {
    const w = totalWidth * c.w;
    doc.text(c.label, x, headerY, { width: w, align: c.align });
    x += w;
  });
  doc.y = headerY + 14;
  doc.moveTo(left, doc.y).lineTo(right, doc.y).strokeColor('#ddd').stroke();
  doc.moveDown(0.4);

  items.forEach((it) => {
    ensureSpace(doc, 20);
    x = left;
    const rowY = doc.y;
    doc.font(FONT_REGULAR).fontSize(9).fillColor('#1a1a2e');
    const values = ['신세계상품권', won(it.denom), `${it.qty}개`, won(it.denom * it.qty)];
    cols.forEach((c, i) => {
      const w = totalWidth * c.w;
      doc.text(values[i], x, rowY, { width: w, align: c.align });
      x += w;
    });
    doc.y = rowY + 16;
  });
}

function pinSections(doc, items) {
  items.forEach((it) => {
    if (!it.pins.length) return;
    ensureSpace(doc, 26);
    doc.font(FONT_BOLD).fontSize(9).fillColor('#555').text(`${won(it.denom)} × ${it.qty}`);
    doc.moveDown(0.2);
    doc.font(FONT_REGULAR).fontSize(8).fillColor('#333');
    it.pins.forEach((pin, i) => {
      ensureSpace(doc, 13);
      doc.text(`${i + 1}. ${pin}`);
    });
    doc.moveDown(0.5);
  });
}

function imagesSection(doc, items, resolveImagePath) {
  const imgW = 240;
  const imgH = 110;
  items.forEach((it) => {
    (it.images || []).forEach((imageId) => {
      const filePath = resolveImagePath(imageId);
      if (!filePath || !fs.existsSync(filePath)) return;
      ensureSpace(doc, imgH + 14);
      try {
        doc.image(filePath, doc.page.margins.left, doc.y, { fit: [imgW, imgH] });
      } catch (e) {
        // 손상된 이미지 등은 건너뜁니다.
      }
      doc.y += imgH + 10;
    });
  });
}

// doc: 이미 열린 PDFDocument(여러 payout을 한 문서에 이어 붙일 때는 호출 전에
//      addPage()로 새 페이지를 열어서 넘겨주세요).
// resolveImagePath(imageId) => 로컬 파일 경로 또는 null
function renderPayoutPdf(doc, payout, resolveImagePath) {
  doc.font(FONT_BOLD).fontSize(18).fillColor('#1a1a2e').text('상품권 지급 내역서');
  doc.moveDown(0.15);
  doc.font(FONT_REGULAR).fontSize(9).fillColor('#888')
    .text(`${payout.id} · 지급일 ${fmtDate(payout.createdAt)}`);
  doc.moveDown(0.6);

  doc.font(FONT_BOLD).fontSize(10).fillColor('#1a1a2e').text(BIZ_NAME);
  doc.font(FONT_REGULAR).fontSize(8).fillColor('#666')
    .text(BIZ_REG_NO)
    .text(BIZ_ADDR);
  doc.fillColor('#1a1a2e');
  doc.moveDown(0.6);
  doc.moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y)
    .strokeColor('#ddd').stroke();
  doc.moveDown(0.8);

  sectionTitle(doc, '지급 정보');
  infoLine(doc, '지급번호', payout.id);
  infoLine(doc, '주문번호', payout.orderNo || '-');
  doc.moveDown(0.3);

  sectionTitle(doc, '고객 정보');
  infoLine(doc, '고객명', payout.customer.name);
  doc.moveDown(0.3);

  sectionTitle(doc, '상품 내역');
  itemsTable(doc, payout.items);
  doc.moveDown(0.3);
  doc.font(FONT_BOLD).fontSize(11).fillColor('#5b3df0')
    .text(`지급 총액  ${won(payoutTotal(payout))}`, { align: 'right' });
  doc.fillColor('#1a1a2e');
  doc.moveDown(0.8);

  sectionTitle(doc, '전달된 상품권 핀번호');
  if (payout.items.some((it) => it.pins.length)) {
    pinSections(doc, payout.items);
  } else {
    doc.font(FONT_REGULAR).fontSize(9).fillColor('#999').text('등록된 핀번호 없음');
    doc.moveDown(0.5);
  }

  const hasImages = payout.items.some((it) => (it.images || []).length);
  if (hasImages) {
    sectionTitle(doc, '상품권 사진');
    imagesSection(doc, payout.items, resolveImagePath);
  }

  if (payout.memo) {
    doc.moveDown(0.6);
    doc.font(FONT_REGULAR).fontSize(8).fillColor('#888').text(`메모: ${payout.memo}`);
    doc.fillColor('#1a1a2e');
  }
}

function createDoc() {
  const doc = new PDFDocument({ size: 'A4', margin: 40, bufferPages: true });
  doc.registerFont('body', FONT_REGULAR);
  doc.registerFont('body-bold', FONT_BOLD);
  return doc;
}

module.exports = { createDoc, renderPayoutPdf, FONT_REGULAR, FONT_BOLD };
