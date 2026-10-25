// 관리자 "지급내역" 탭: 고객에게 전달한 상품권(핀번호·사진)을 인보이스와 별도로 기록/조회합니다.
// js/admin.js 의 공용 함수(escapeHtml, putImage/getImage/deleteImage, imageSrc 등)를 사용하므로
// 반드시 admin.js 뒤에 로드해야 합니다. 텍스트 데이터는 localStorage, 사진 원본은 IndexedDB에 저장합니다.

const PAYOUTS_KEY = 'kk_admin_payouts';

function loadPayouts() {
  try {
    return JSON.parse(adminInvoiceStorage.getItem(PAYOUTS_KEY)) || [];
  } catch (e) {
    return [];
  }
}

function savePayouts(list) {
  adminInvoiceStorage.setItem(PAYOUTS_KEY, JSON.stringify(list));
}

let payouts = loadPayouts();

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

const payoutImageUrls = [];
const payoutKeywordInput = document.getElementById('payoutKeyword');

function renderPayouts() {
  const tbody = document.getElementById('payoutTableBody');
  const empty = document.getElementById('payoutEmpty');
  tbody.innerHTML = '';
  revokeUrls(payoutImageUrls);

  const keyword = payoutKeywordInput.value.trim().toLowerCase();
  const list = payouts.filter((p) => {
    if (!keyword) return true;
    const hay = [p.orderNo, p.customer.name, p.brandName, ...(p.pins || [])]
      .join(' ')
      .toLowerCase();
    return hay.includes(keyword);
  });

  empty.hidden = list.length !== 0;
  empty.textContent = payouts.length ? '조건에 맞는 지급내역이 없습니다.' : '등록된 지급내역이 없습니다.';

  list.forEach((p) => {
    const pins = Array.isArray(p.pins) ? p.pins : [];
    const imageIds = Array.isArray(p.images) ? p.images : [];
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${fmtDate(p.createdAt)}</td>
      <td>${escapeHtml(p.orderNo) || '-'}</td>
      <td>${escapeHtml(p.customer.name)}</td>
      <td>${escapeHtml(p.brandName)}<br><small class="payout-sub">${won(p.denom)} × ${p.qty}</small></td>
      <td>${pins.length
        ? `<div class="pin-list">${pins.map((x) => `<div>${escapeHtml(x)}</div>`).join('')}</div>`
        : '<span class="badge-pin badge-pin-none">미등록</span>'}</td>
      <td><div class="payout-thumbs">${imageIds.length ? '' : '-'}</div></td>
      <td class="payout-memo">${escapeHtml(p.memo) || '-'}</td>
      <td><button type="button" class="payout-del">삭제</button></td>
    `;

    if (imageIds.length) {
      const box = tr.querySelector('.payout-thumbs');
      Promise.all(imageIds.map((id) => getImage(id).catch(() => null))).then((values) => {
        const found = values.filter(Boolean);
        if (!box.isConnected) return;
        if (!found.length) {
          box.textContent = '불러오기 실패';
          return;
        }
        found.forEach((value) => {
          const src = imageSrc(value, payoutImageUrls);
          const link = document.createElement('a');
          link.href = src;
          link.target = '_blank';
          link.rel = 'noopener';
          link.title = '클릭하면 원본 크기로 열립니다';
          const img = new Image();
          img.src = src;
          img.alt = '상품권 사진';
          link.appendChild(img);
          box.appendChild(link);
        });
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

function deletePayout(p) {
  if (!window.confirm('이 지급내역을 삭제할까요? 사진과 핀번호도 함께 삭제되며 되돌릴 수 없습니다.')) return false;
  (p.images || []).forEach((id) => deleteImage(id).catch(() => {}));
  payouts = payouts.filter((x) => x.id !== p.id);
  savePayouts(payouts);
  renderPayouts();
  return true;
}

payoutKeywordInput.addEventListener('input', renderPayouts);

// ---- 등록 폼 ----

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
  const id = `PO-${createdAt.slice(0, 10).replace(/-/g, '')}-${Date.now().toString(36).toUpperCase()}`;

  const record = {
    id,
    createdAt,
    orderNo,
    customer: { name },
    brand,
    brandName,
    denom,
    qty,
    pins,
    images: [],
    memo,
  };

  if (payoutPendingImages.length) {
    const imageIds = payoutPendingImages.map((_, i) => `${id}-img${i + 1}`);
    submitBtn.disabled = true;
    try {
      if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
      await Promise.all(payoutPendingImages.map((file, i) => putImage(imageIds[i], file)));
    } catch (err) {
      imageIds.forEach((imageId) => deleteImage(imageId).catch(() => {}));
      showPayoutError('이 브라우저에서는 사진을 저장할 수 없습니다. 사진을 빼고 다시 시도해주세요.');
      return;
    } finally {
      submitBtn.disabled = false;
    }
    record.images = imageIds;
  }

  payouts.unshift(record);
  savePayouts(payouts);

  payoutPendingImages = [];
  renderPayoutPreview();
  payoutOverlay.hidden = true;
  switchTab('payouts');
});

// ---- 상세 / PDF ----

const payoutDetailOverlay = document.getElementById('payoutDetailOverlay');
const payoutDetailBody = document.getElementById('payoutDetailBody');
const payoutDetailUrls = [];
let currentPayout = null;

function closePayoutDetail() {
  payoutDetailOverlay.hidden = true;
  revokeUrls(payoutDetailUrls);
  currentPayout = null;
}

function openPayoutDetail(p) {
  currentPayout = p;
  revokeUrls(payoutDetailUrls);
  const pins = Array.isArray(p.pins) ? p.pins : [];
  const imageIds = Array.isArray(p.images) ? p.images : [];

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
          <tr>
            <td>${escapeHtml(p.brandName)}</td>
            <td class="num">${won(p.denom)}</td>
            <td class="num">${p.qty}개</td>
            <td class="num">${won(p.denom * p.qty)}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="invoice-section">
      <h3>전달된 상품권 핀번호</h3>
      ${pins.length
        ? `<ol class="invoice-pins">${pins.map((x) => `<li>${escapeHtml(x)}</li>`).join('')}</ol>`
        : '<div class="payout-none">등록된 핀번호 없음</div>'}
    </div>

    ${imageIds.length ? `
    <div class="invoice-section">
      <h3>상품권 사진</h3>
      <div class="invoice-images" id="payoutDetailImages"></div>
    </div>` : ''}

    ${p.memo ? `<div class="invoice-memo">메모: ${escapeHtml(p.memo)}</div>` : ''}
  `;

  if (imageIds.length) {
    const box = document.getElementById('payoutDetailImages');
    Promise.all(imageIds.map((id) => getImage(id).catch(() => null))).then((values) => {
      const found = values.filter(Boolean);
      if (!box.isConnected) return;
      if (!found.length) {
        box.textContent = '저장된 사진을 불러올 수 없습니다. (다른 브라우저/기기에서 등록한 건은 사진이 보이지 않습니다.)';
        return;
      }
      found.forEach((value) => {
        const src = imageSrc(value, payoutDetailUrls);
        const link = document.createElement('a');
        link.href = src;
        link.target = '_blank';
        link.rel = 'noopener';
        link.title = '클릭하면 원본 크기로 열립니다';
        const img = new Image();
        img.src = src;
        img.alt = '상품권 사진';
        link.appendChild(img);
        box.appendChild(link);
      });
    });
  }

  payoutDetailOverlay.hidden = false;
}

document.getElementById('payoutDetailClose').addEventListener('click', closePayoutDetail);
payoutDetailOverlay.addEventListener('click', (e) => {
  if (e.target === payoutDetailOverlay) closePayoutDetail();
});

document.getElementById('payoutDetailDelete').addEventListener('click', () => {
  if (currentPayout && deletePayout(currentPayout)) closePayoutDetail();
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

renderPayouts();
