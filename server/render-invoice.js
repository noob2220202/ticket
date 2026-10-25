// 지급내역서 상세 화면(admin-payouts.js의 openPayoutDetail)과 완전히 같은 마크업을
// 서버에서 만들어, 헤드리스 브라우저로 "그대로" 인쇄할 수 있게 합니다.
// (일괄 PDF 다운로드가 개별 다운로드와 디자인이 다르다는 피드백을 받아서,
// pdfkit으로 직접 그리던 방식 대신 실제 화면/CSS를 그대로 인쇄하는 방식으로 교체)
//
// admin-payouts.js의 openPayoutDetail() 템플릿을 고치면 이 파일도 같이 고쳐야
// 디자인이 계속 일치합니다.

function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const won = (n) => n.toLocaleString('ko-KR') + '원';

function fmtDate(iso) {
  const d = new Date(iso);
  return d.toLocaleString('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

function payoutTotal(p) {
  return (p.items || []).reduce((s, it) => s + it.denom * it.qty, 0);
}

// imageUrlFor(imageId) => 이 페이지를 띄울 때 쓸 이미지 URL(토큰 포함)
function invoiceDocHtml(p, imageUrlFor) {
  const items = Array.isArray(p.items) ? p.items : [];
  const total = payoutTotal(p);

  const itemRows = items.map((it) => `
          <tr>
            <td>${escapeHtml(p.brandName)}</td>
            <td class="num">${won(it.denom)}</td>
            <td class="num">${it.qty}개</td>
            <td class="num">${won(it.denom * it.qty)}</td>
          </tr>`).join('');

  const pinSection = items.some((it) => it.pins.length)
    ? items.map((it) => (it.pins.length ? `
        <div class="payout-pin-group">
          <div class="payout-pin-group-title">${won(it.denom)} × ${it.qty}</div>
          <ol class="invoice-pins">${it.pins.map((x) => `<li>${escapeHtml(x)}</li>`).join('')}</ol>
        </div>` : '')).join('')
    : '<div class="payout-none">등록된 핀번호 없음</div>';

  const allImageIds = items.flatMap((it) => it.images || []);
  const imagesHtml = allImageIds.map((id) => `
        <a href="${imageUrlFor(id)}" target="_blank" rel="noopener" title="클릭하면 원본 크기로 열립니다">
          <img src="${imageUrlFor(id)}" alt="상품권 사진">
        </a>`).join('');

  return `
    <div class="invoice-doc-head">
      <div>
        <h2>상품권 지급 내역서</h2>
        <div class="invoice-no">${escapeHtml(p.id)} · 지급일 ${fmtDate(p.createdAt)}</div>
      </div>
      <div class="invoice-brand">
        <strong>복드림 상품권</strong>
        사업자등록번호 623-70-00295<br>
        서울특별시 성동구 천호대로 430, 1층 103호(용답동)
      </div>
    </div>

    <div class="invoice-section">
      <h3>지급 정보</h3>
      <div class="invoice-grid">
        <div><dt>지급번호</dt><dd>${escapeHtml(p.id)}</dd></div>
        <div><dt>주문번호</dt><dd>${escapeHtml(p.orderNo) || '-'}</dd></div>
      </div>
    </div>

    <div class="invoice-section">
      <h3>고객 정보</h3>
      <div class="invoice-grid">
        <div><dt>고객명</dt><dd>${escapeHtml(p.customer.name)}</dd></div>
      </div>
    </div>

    <div class="invoice-section">
      <h3>상품 내역</h3>
      <table class="invoice-items">
        <thead>
          <tr>
            <th>상품권</th>
            <th class="num">액면가</th>
            <th class="num">수량</th>
            <th class="num">액면 합계</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
      </table>
      <div class="invoice-total">
        <span>지급 총액 <strong>${won(total)}</strong></span>
      </div>
    </div>

    <div class="invoice-section">
      <h3>전달된 상품권 핀번호</h3>
      ${pinSection}
    </div>

    ${allImageIds.length ? `
    <div class="invoice-section">
      <h3>상품권 사진</h3>
      <div class="invoice-images" id="payoutDetailImages">${imagesHtml}</div>
    </div>` : ''}

    ${p.memo ? `<div class="invoice-memo">메모: ${escapeHtml(p.memo)}</div>` : ''}
  `;
}

// admin.html과 같은 <head>(CDN 폰트 + 같은 스타일시트)를 쓰는 독립 페이지.
// body에는 overlay 한 겹만 있어서(#adminGate, #adminDashboard 같은 큰 요소가 아예
// 없음) 인쇄 시 빈 페이지가 생길 걱정도 없습니다.
function renderPrintPage(p, imageUrlFor) {
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="preconnect" href="https://cdn.jsdelivr.net">
<link rel="stylesheet" as="style" crossorigin href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.css">
<link rel="stylesheet" href="/css/style.css">
<link rel="stylesheet" href="/css/admin.css">
<title>지급내역서_${escapeHtml(p.id)}</title>
</head>
<body>
<div class="invoice-overlay"><div class="invoice-sheet"><div class="invoice-doc">${invoiceDocHtml(p, imageUrlFor)}</div></div></div>
</body>
</html>`;
}

module.exports = { renderPrintPage, invoiceDocHtml };
