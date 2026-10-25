// 관리자 "지급내역" 탭: 고객에게 전달한 상품권(핀번호·사진)을 인보이스와 별도로 기록/조회합니다.
// js/admin.js 의 공용 함수(escapeHtml, won, fmtDate, getAdminToken 등)를 사용하므로
// 반드시 admin.js 뒤에 로드해야 합니다.
//
// 데이터는 더 이상 브라우저 localStorage/IndexedDB에만 있지 않고, 서버(server/index.js)의
// SQLite DB(data/payouts.db)에 실제로 저장됩니다. 그래야 브라우저/기기를 바꿔도, 서버를
// 재시작해도 지급내역과 사진이 그대로 남습니다.
//
// 지급내역 1건(payout)은 "거래" 단위이며, 그 안에 액면별 아이템(items)이 여러 개
// 들어갈 수 있습니다(예: 50만원×7 + 10만원×2 + 1만원×1). 과거에는 액면마다 행이
// 따로 생겼지만, 지금은 같은 거래(주문번호)로 들어온 액면들을 한 행으로 묶어 보여줍니다.

const PAYOUTS_API = '/api/payouts';

function payoutAuthHeaders(extra) {
  return Object.assign({ 'x-admin-token': getAdminToken() }, extra || {});
}

async function apiListPayouts() {
  const res = await fetch(PAYOUTS_API, { headers: payoutAuthHeaders() });
  if (!res.ok) throw new Error('지급내역을 불러오지 못했습니다.');
  return res.json();
}

async function apiCreatePayout(payload) {
  const res = await fetch(PAYOUTS_API, {
    method: 'POST',
    headers: payoutAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || '저장에 실패했습니다.');
  return data; // { payoutId, itemId, merged }
}

async function apiUploadItemImages(itemId, files) {
  const form = new FormData();
  files.forEach((file) => form.append('images', file));
  const res = await fetch(`/api/payout-items/${encodeURIComponent(itemId)}/images`, {
    method: 'POST',
    headers: payoutAuthHeaders(),
    body: form,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || '사진 업로드에 실패했습니다.');
  return data.images || [];
}

async function apiDeletePayout(id) {
  const res = await fetch(`${PAYOUTS_API}/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: payoutAuthHeaders(),
  });
  if (!res.ok && res.status !== 204) throw new Error('삭제에 실패했습니다.');
}

function payoutImageUrl(imageId) {
  return `/api/images/${encodeURIComponent(imageId)}?token=${encodeURIComponent(getAdminToken())}`;
}

let payouts = [];

async function reloadPayouts() {
  payouts = await apiListPayouts();
}

function payoutTotal(p) {
  return (p.items || []).reduce((sum, it) => sum + it.denom * it.qty, 0);
}

function payoutAllPins(p) {
  return (p.items || []).flatMap((it) => it.pins || []);
}

// ---- 탭 전환 ----

const adminTitle = document.getElementById('adminTitle');
const tabOrders = document.getElementById('tabOrders');
const tabPayouts = document.getElementById('tabPayouts');
const TAB_TITLES = { orders: '주문 · 매입 관리', payouts: '지급내역' };

function switchTab(name) {
  document.querySelectorAll('.admin-tab').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === name);
  });
  tabOrders.hidden = name !== 'orders';
  tabPayouts.hidden = name !== 'payouts';
  adminTitle.textContent = TAB_TITLES[name];
  if (newInvoiceBtn) newInvoiceBtn.hidden = name !== 'orders';
  if (name === 'payouts') renderPayouts();
}

document.querySelectorAll('.admin-tab').forEach((btn) => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

// ---- 목록 ----

const payoutKeywordInput = document.getElementById('payoutKeyword');

async function renderPayouts() {
  const tbody = document.getElementById('payoutTableBody');
  const empty = document.getElementById('payoutEmpty');

  try {
    await reloadPayouts();
  } catch (err) {
    tbody.innerHTML = '';
    empty.hidden = false;
    empty.textContent = err.message || '지급내역을 불러오지 못했습니다.';
    return;
  }

  tbody.innerHTML = '';

  const keyword = payoutKeywordInput.value.trim().toLowerCase();
  const list = payouts.filter((p) => {
    if (!keyword) return true;
    const hay = [p.orderNo, p.customer.name, p.brandName, ...payoutAllPins(p)]
      .join(' ')
      .toLowerCase();
    return hay.includes(keyword);
  });

  empty.hidden = list.length !== 0;
  empty.textContent = payouts.length ? '조건에 맞는 지급내역이 없습니다.' : '등록된 지급내역이 없습니다.';

  list.forEach((p) => {
    const items = Array.isArray(p.items) ? p.items : [];
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${fmtDate(p.createdAt)}</td>
      <td>${escapeHtml(p.orderNo) || '-'}</td>
      <td>${escapeHtml(p.customer.name)}</td>
      <td>${escapeHtml(p.brandName)}<br>${items.map((it) =>
        `<small class="payout-sub">${won(it.denom)} × ${it.qty}</small>`).join('<br>')}</td>
      <td>${items.map((it) => (it.pins.length
        ? `<div class="pin-list">${it.pins.map((x) => `<div>${escapeHtml(x)}</div>`).join('')}</div>`
        : '<span class="badge-pin badge-pin-none">미등록</span>')).join('')}</td>
      <td><div class="payout-thumbs"></div></td>
      <td class="payout-memo">${escapeHtml(p.memo) || '-'}</td>
      <td><button type="button" class="payout-del">삭제</button></td>
    `;

    const box = tr.querySelector('.payout-thumbs');
    const allImageIds = items.flatMap((it) => it.images || []);
    if (!allImageIds.length) {
      box.textContent = '-';
    } else {
      allImageIds.forEach((id) => {
        const link = document.createElement('a');
        link.href = payoutImageUrl(id);
        link.target = '_blank';
        link.rel = 'noopener';
        link.title = '클릭하면 원본 크기로 열립니다';
        const img = new Image();
        img.src = payoutImageUrl(id);
        img.alt = '상품권 사진';
        link.appendChild(img);
        box.appendChild(link);
      });
    }

    tr.querySelector('.payout-del').addEventListener('click', () => deletePayout(p));
    tr.addEventListener('click', (e) => {
      if (e.target.closest('a, button, .pin-list')) return;
      openPayoutDetail(p);
    });

    tbody.appendChild(tr);
  });
}

async function deletePayout(p) {
  if (!window.confirm('이 지급내역을 삭제할까요? 사진과 핀번호도 함께 삭제되며 되돌릴 수 없습니다.')) return false;
  try {
    await apiDeletePayout(p.id);
  } catch (err) {
    window.alert(err.message || '삭제에 실패했습니다.');
    return false;
  }
  await renderPayouts();
  return true;
}

payoutKeywordInput.addEventListener('input', renderPayouts);

// ---- 검색결과 PDF 일괄 다운로드(ZIP) ----

const payoutExportBtn = document.getElementById('payoutExportBtn');

payoutExportBtn.addEventListener('click', async () => {
  const keyword = payoutKeywordInput.value.trim();
  const originalLabel = payoutExportBtn.textContent;
  payoutExportBtn.disabled = true;
  payoutExportBtn.textContent = '생성 중...';

  try {
    const url = `/api/payouts/export-zip?keyword=${encodeURIComponent(keyword)}`;
    const res = await fetch(url, { headers: payoutAuthHeaders() });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'PDF 생성에 실패했습니다.');
    }
    const blob = await res.blob();
    const disposition = res.headers.get('Content-Disposition') || '';
    const match = disposition.match(/filename="([^"]+)"/);
    const filename = match ? decodeURIComponent(match[1]) : `지급내역서_${keyword || '전체'}.zip`;

    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(blobUrl);
  } catch (err) {
    window.alert(err.message || 'PDF 생성에 실패했습니다.');
  } finally {
    payoutExportBtn.disabled = false;
    payoutExportBtn.textContent = originalLabel;
  }
});

// ---- 등록 폼 ----
// 폼은 한 번에 액면 하나만 입력합니다. 같은 거래에 다른 액면을 더 추가하려면
// 주문번호를 똑같이 입력해서 다시 등록하면 서버가 자동으로 같은 거래에 합칩니다.

const payoutOverlay = document.getElementById('payoutOverlay');
const payoutForm = document.getElementById('payoutForm');
const payoutError = document.getElementById('payoutError');
const pBrandSelect = document.getElementById('pBrand');
const pBrandNameInput = document.getElementById('pBrandName');
const pImagesInput = document.getElementById('pImages');
const pImagePreview = document.getElementById('pImagePreview');

let payoutPendingImages = [];
const payoutPreviewUrls = [];

function showPayoutError(message) {
  payoutError.textContent = message;
  payoutError.hidden = false;
}

function renderPayoutPreview() {
  pImagePreview.innerHTML = '';
  revokeUrls(payoutPreviewUrls);
  payoutPendingImages.forEach((file, i) => {
    const item = document.createElement('div');
    item.className = 'create-image-item';
    const img = document.createElement('img');
    img.src = imageSrc(file, payoutPreviewUrls);
    img.alt = `상품권 사진 ${i + 1}`;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = '×';
    btn.setAttribute('aria-label', '사진 삭제');
    btn.addEventListener('click', () => {
      payoutPendingImages.splice(i, 1);
      renderPayoutPreview();
    });
    item.append(img, btn);
    pImagePreview.appendChild(item);
  });
}

pImagesInput.addEventListener('change', () => {
  const files = Array.from(pImagesInput.files);
  pImagesInput.value = '';
  payoutError.hidden = true;
  files.forEach((file) => {
    if (file.type.startsWith('image/')) {
      payoutPendingImages.push(file);
    } else {
      showPayoutError(`${file.name}: 이미지 파일만 올릴 수 있습니다.`);
    }
  });
  renderPayoutPreview();
});

pBrandSelect.addEventListener('change', () => {
  pBrandNameInput.value = pBrandSelect.value === 'etc' ? '' : (BRAND_FULL_NAME[pBrandSelect.value] || '');
});

document.getElementById('newPayoutBtn').addEventListener('click', () => {
  payoutForm.reset();
  payoutError.hidden = true;
  payoutPendingImages = [];
  renderPayoutPreview();
  document.getElementById('pDate').value = nowLocalInputValue();
  pBrandNameInput.value = BRAND_FULL_NAME[pBrandSelect.value] || '';
  payoutOverlay.hidden = false;
});

document.getElementById('payoutClose').addEventListener('click', () => {
  payoutOverlay.hidden = true;
});
payoutOverlay.addEventListener('click', (e) => {
  if (e.target === payoutOverlay) payoutOverlay.hidden = true;
});

payoutForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  payoutError.hidden = true;
  const submitBtn = payoutForm.querySelector('button[type="submit"]');

  const name = document.getElementById('pName').value.trim();
  const brand = pBrandSelect.value;
  const brandName = pBrandNameInput.value.trim() || BRAND_FULL_NAME[brand] || '상품권';
  const denom = Number(document.getElementById('pDenom').value);
  const qty = Number(document.getElementById('pQty').value);
  const orderNo = document.getElementById('pOrderNo').value.trim();
  const memo = document.getElementById('pMemo').value.trim();
  const dateVal = document.getElementById('pDate').value;
  const pins = document.getElementById('pPins').value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (!name) {
    showPayoutError('고객명을 입력해주세요.');
    return;
  }
  if (!denom || denom <= 0 || !qty || qty <= 0) {
    showPayoutError('액면가와 수량을 올바르게 입력해주세요.');
    return;
  }
  if (!pins.length && !payoutPendingImages.length) {
    showPayoutError('핀번호 또는 상품권 사진 중 하나는 입력해주세요.');
    return;
  }

  const createdAt = dateVal ? new Date(dateVal).toISOString() : new Date().toISOString();

  submitBtn.disabled = true;
  try {
    const result = await apiCreatePayout({
      createdAt, orderNo, customerName: name, brand, brandName, denom, qty, pins, memo,
    });

    if (payoutPendingImages.length) {
      await apiUploadItemImages(result.itemId, payoutPendingImages);
    }
  } catch (err) {
    showPayoutError(err.message || '저장에 실패했습니다.');
    submitBtn.disabled = false;
    return;
  }
  submitBtn.disabled = false;

  payoutPendingImages = [];
  renderPayoutPreview();
  payoutOverlay.hidden = true;
  switchTab('payouts');
});

// ---- 상세 / PDF ----

const payoutDetailOverlay = document.getElementById('payoutDetailOverlay');
const payoutDetailBody = document.getElementById('payoutDetailBody');
let currentPayout = null;

function closePayoutDetail() {
  payoutDetailOverlay.hidden = true;
  currentPayout = null;
}

function openPayoutDetail(p) {
  currentPayout = p;
  const items = Array.isArray(p.items) ? p.items : [];
  const total = payoutTotal(p);

  payoutDetailBody.innerHTML = `
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
        <tbody>
          ${items.map((it) => `
          <tr>
            <td>${escapeHtml(p.brandName)}</td>
            <td class="num">${won(it.denom)}</td>
            <td class="num">${it.qty}개</td>
            <td class="num">${won(it.denom * it.qty)}</td>
          </tr>`).join('')}
        </tbody>
      </table>
      <div class="invoice-total">
        <span>지급 총액 <strong>${won(total)}</strong></span>
      </div>
    </div>

    <div class="invoice-section">
      <h3>전달된 상품권 핀번호</h3>
      ${items.some((it) => it.pins.length) ? items.map((it) => (it.pins.length ? `
        <div class="payout-pin-group">
          <div class="payout-pin-group-title">${won(it.denom)} × ${it.qty}</div>
          <ol class="invoice-pins">${it.pins.map((x) => `<li>${escapeHtml(x)}</li>`).join('')}</ol>
        </div>` : '')).join('') : '<div class="payout-none">등록된 핀번호 없음</div>'}
    </div>

    ${items.some((it) => it.images.length) ? `
    <div class="invoice-section">
      <h3>상품권 사진</h3>
      <div class="invoice-images" id="payoutDetailImages"></div>
    </div>` : ''}

    ${p.memo ? `<div class="invoice-memo">메모: ${escapeHtml(p.memo)}</div>` : ''}
  `;

  const allImageIds = items.flatMap((it) => it.images || []);
  if (allImageIds.length) {
    const box = document.getElementById('payoutDetailImages');
    allImageIds.forEach((id) => {
      const link = document.createElement('a');
      link.href = payoutImageUrl(id);
      link.target = '_blank';
      link.rel = 'noopener';
      link.title = '클릭하면 원본 크기로 열립니다';
      const img = new Image();
      img.src = payoutImageUrl(id);
      img.alt = '상품권 사진';
      link.appendChild(img);
      box.appendChild(link);
    });
  }

  payoutDetailOverlay.hidden = false;
}

document.getElementById('payoutDetailClose').addEventListener('click', closePayoutDetail);
payoutDetailOverlay.addEventListener('click', (e) => {
  if (e.target === payoutDetailOverlay) closePayoutDetail();
});

document.getElementById('payoutDetailDelete').addEventListener('click', async () => {
  if (currentPayout && (await deletePayout(currentPayout))) closePayoutDetail();
});

// 사진이 모두 로드된 뒤 인쇄하고, 저장되는 PDF 파일명이 지급내역서_번호가 되도록 제목을 잠시 바꿉니다.
document.getElementById('payoutDetailPrint').addEventListener('click', async () => {
  const imgs = Array.from(payoutDetailBody.querySelectorAll('img'));
  await Promise.all(imgs.map((img) => (img.complete ? null : new Promise((resolve) => {
    img.onload = resolve;
    img.onerror = resolve;
  }))));

  const prevTitle = document.title;
  document.title = `지급내역서_${currentPayout ? currentPayout.id : ''}`;
  const restore = () => {
    document.title = prevTitle;
    window.removeEventListener('afterprint', restore);
  };
  window.addEventListener('afterprint', restore);
  window.print();
});

if (isAuthed()) renderPayouts();
