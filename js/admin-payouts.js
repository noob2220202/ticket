// 관리자 "지급내역" 탭: IndexedDB 기반 스토리지 (localStorage 대비 용량 무제한)
// 사진 원본도 같은 DB의 'images' 스토어에 저장합니다.
// admin.js 뒤에 로드해야 합니다.

// ── IndexedDB ────────────────────────────────────────────────────────────────
const PAYOUT_DB_NAME = 'kk_admin_payouts_db';
const PAYOUT_STORE   = 'payouts';
const PIMAGE_STORE   = 'images';

let _payoutDb = null;

function openPayoutDb() {
  if (_payoutDb) return Promise.resolve(_payoutDb);
  return new Promise((res, rej) => {
    const req = indexedDB.open(PAYOUT_DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(PAYOUT_STORE)) {
        const s = db.createObjectStore(PAYOUT_STORE, { keyPath: 'id' });
        s.createIndex('createdAt', 'createdAt');
      }
      if (!db.objectStoreNames.contains(PIMAGE_STORE)) {
        db.createObjectStore(PIMAGE_STORE);
      }
    };
    req.onsuccess = e => { _payoutDb = e.target.result; res(_payoutDb); };
    req.onerror   = e => rej(e.target.error);
  });
}

async function dbGetAllPayouts() {
  const db = await openPayoutDb();
  return new Promise((res, rej) => {
    const req = db.transaction(PAYOUT_STORE, 'readonly')
                  .objectStore(PAYOUT_STORE).getAll();
    req.onsuccess = e => res(e.target.result || []);
    req.onerror   = e => rej(e.target.error);
  });
}

async function dbPutPayout(record) {
  const db = await openPayoutDb();
  return new Promise((res, rej) => {
    const req = db.transaction(PAYOUT_STORE, 'readwrite')
                  .objectStore(PAYOUT_STORE).put(record);
    req.onsuccess = () => res();
    req.onerror   = e => rej(e.target.error);
  });
}

async function dbDeletePayout(id) {
  const db = await openPayoutDb();
  return new Promise((res, rej) => {
    const req = db.transaction(PAYOUT_STORE, 'readwrite')
                  .objectStore(PAYOUT_STORE).delete(id);
    req.onsuccess = () => res();
    req.onerror   = e => rej(e.target.error);
  });
}

async function dbCountPayouts() {
  const db = await openPayoutDb();
  return new Promise((res, rej) => {
    const req = db.transaction(PAYOUT_STORE, 'readonly')
                  .objectStore(PAYOUT_STORE).count();
    req.onsuccess = e => res(e.target.result);
    req.onerror   = e => rej(e.target.error);
  });
}

// 이미지 (payout 전용 DB)
async function dbPutPayoutImage(id, blob) {
  const db = await openPayoutDb();
  return new Promise((res, rej) => {
    const req = db.transaction(PIMAGE_STORE, 'readwrite')
                  .objectStore(PIMAGE_STORE).put(blob, id);
    req.onsuccess = () => res();
    req.onerror   = e => rej(e.target.error);
  });
}

async function dbGetPayoutImage(id) {
  const db = await openPayoutDb();
  return new Promise((res, rej) => {
    const req = db.transaction(PIMAGE_STORE, 'readonly')
                  .objectStore(PIMAGE_STORE).get(id);
    req.onsuccess = e => res(e.target.result);
    req.onerror   = e => rej(e.target.error);
  });
}

async function dbDeletePayoutImage(id) {
  const db = await openPayoutDb();
  return new Promise((res, rej) => {
    const req = db.transaction(PIMAGE_STORE, 'readwrite')
                  .objectStore(PIMAGE_STORE).delete(id);
    req.onsuccess = () => res();
    req.onerror   = e => rej(e.target.error);
  });
}

// ── 메모리 캐시 ─────────────────────────────────────────────────────────────
let payouts = [];   // DB에서 로드 후 정렬된 배열

async function reloadPayouts() {
  const all = await dbGetAllPayouts();
  payouts = all.sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));
}

// ── 탭 전환 ─────────────────────────────────────────────────────────────────
const adminTitle = document.getElementById('adminTitle');
const tabOrders  = document.getElementById('tabOrders');
const tabPayouts = document.getElementById('tabPayouts');
const TAB_TITLES = { orders: '주문 · 매입 관리', payouts: '지급내역' };

function switchTab(name) {
  document.querySelectorAll('.admin-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === name);
  });
  tabOrders.hidden  = name !== 'orders';
  tabPayouts.hidden = name !== 'payouts';
  adminTitle.textContent = TAB_TITLES[name];
  if (newInvoiceBtn) newInvoiceBtn.hidden = name !== 'orders';
  if (name === 'payouts') renderPayouts();
}

document.querySelectorAll('.admin-tab').forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

// ── 목록 렌더 ────────────────────────────────────────────────────────────────
const payoutImageUrls  = [];
const payoutKeywordInput = document.getElementById('payoutKeyword');

function renderPayouts() {
  const tbody = document.getElementById('payoutTableBody');
  const empty = document.getElementById('payoutEmpty');
  tbody.innerHTML = '';
  revokeUrls(payoutImageUrls);

  const keyword = payoutKeywordInput.value.trim().toLowerCase();
  const list = payouts.filter(p => {
    if (!keyword) return true;
    const hay = [p.orderNo, p.customer.name, p.brandName, ...(p.pins || [])]
      .join(' ').toLowerCase();
    return hay.includes(keyword);
  });

  empty.hidden = list.length !== 0;
  empty.textContent = payouts.length
    ? '조건에 맞는 지급내역이 없습니다.'
    : '등록된 지급내역이 없습니다.';

  list.forEach(p => {
    const pins     = Array.isArray(p.pins)   ? p.pins   : [];
    const imageIds = Array.isArray(p.images) ? p.images : [];
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${fmtDate(p.createdAt)}</td>
      <td>${escapeHtml(p.orderNo) || '-'}</td>
      <td>${escapeHtml(p.customer.name)}</td>
      <td>${escapeHtml(p.brandName)}<br><small class="payout-sub">${won(p.denom)} × ${p.qty}</small></td>
      <td>${pins.length
        ? `<div class="pin-list">${pins.map(x => `<div>${escapeHtml(x)}</div>`).join('')}</div>`
        : '<span class="badge-pin badge-pin-none">미등록</span>'}</td>
      <td><div class="payout-thumbs">${imageIds.length ? '' : '-'}</div></td>
      <td class="payout-memo">${escapeHtml(p.memo) || '-'}</td>
      <td><button type="button" class="payout-del">삭제</button></td>
    `;

    if (imageIds.length) {
      const box = tr.querySelector('.payout-thumbs');
      Promise.all(imageIds.map(id => dbGetPayoutImage(id).catch(() => null))).then(values => {
        const found = values.filter(Boolean);
        if (!box.isConnected) return;
        if (!found.length) { box.textContent = '불러오기 실패'; return; }
        found.forEach(value => {
          const src  = imageSrc(value, payoutImageUrls);
          const link = document.createElement('a');
          link.href = src; link.target = '_blank'; link.rel = 'noopener';
          link.title = '클릭하면 원본 크기로 열립니다';
          const img = new Image();
          img.src = src; img.alt = '상품권 사진';
          link.appendChild(img); box.appendChild(link);
        });
      });
    }

    tr.querySelector('.payout-del').addEventListener('click', () => deletePayout(p));
    tr.addEventListener('click', e => {
      if (e.target.closest('a, button, .pin-list')) return;
      openPayoutDetail(p);
    });
    tbody.appendChild(tr);
  });
}

async function deletePayout(p) {
  if (!confirm('이 지급내역을 삭제할까요? 사진과 핀번호도 함께 삭제되며 되돌릴 수 없습니다.')) return false;
  await Promise.all((p.images || []).map(id => dbDeletePayoutImage(id).catch(() => {})));
  await dbDeletePayout(p.id);
  await reloadPayouts();
  renderPayouts();
  return true;
}

payoutKeywordInput.addEventListener('input', renderPayouts);

// ── 등록 폼 ─────────────────────────────────────────────────────────────────
const payoutOverlay   = document.getElementById('payoutOverlay');
const payoutForm      = document.getElementById('payoutForm');
const payoutError     = document.getElementById('payoutError');
const pBrandSelect    = document.getElementById('pBrand');
const pBrandNameInput = document.getElementById('pBrandName');
const pImagesInput    = document.getElementById('pImages');
const pImagePreview   = document.getElementById('pImagePreview');

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
    btn.type = 'button'; btn.textContent = '×';
    btn.setAttribute('aria-label', '사진 삭제');
    btn.addEventListener('click', () => { payoutPendingImages.splice(i, 1); renderPayoutPreview(); });
    item.append(img, btn);
    pImagePreview.appendChild(item);
  });
}

pImagesInput.addEventListener('change', () => {
  const files = Array.from(pImagesInput.files);
  pImagesInput.value = '';
  payoutError.hidden = true;
  files.forEach(file => {
    if (file.type.startsWith('image/')) payoutPendingImages.push(file);
    else showPayoutError(`${file.name}: 이미지 파일만 올릴 수 있습니다.`);
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

document.getElementById('payoutClose').addEventListener('click', () => { payoutOverlay.hidden = true; });
payoutOverlay.addEventListener('click', e => { if (e.target === payoutOverlay) payoutOverlay.hidden = true; });

payoutForm.addEventListener('submit', async e => {
  e.preventDefault();
  payoutError.hidden = true;
  const submitBtn = payoutForm.querySelector('button[type="submit"]');

  const name      = document.getElementById('pName').value.trim();
  const brand     = pBrandSelect.value;
  const brandName = pBrandNameInput.value.trim() || BRAND_FULL_NAME[brand] || '상품권';
  const denom     = Number(document.getElementById('pDenom').value);
  const qty       = Number(document.getElementById('pQty').value);
  const orderNo   = document.getElementById('pOrderNo').value.trim();
  const memo      = document.getElementById('pMemo').value.trim();
  const dateVal   = document.getElementById('pDate').value;
  const pins      = document.getElementById('pPins').value
    .split('\n').map(l => l.trim()).filter(Boolean);

  if (!name) { showPayoutError('고객명을 입력해주세요.'); return; }
  if (!denom || denom <= 0 || !qty || qty <= 0) {
    showPayoutError('액면가와 수량을 올바르게 입력해주세요.'); return;
  }
  if (!pins.length && !payoutPendingImages.length) {
    showPayoutError('핀번호 또는 상품권 사진 중 하나는 입력해주세요.'); return;
  }

  const createdAt = dateVal ? new Date(dateVal).toISOString() : new Date().toISOString();
  const id = `PO-${createdAt.slice(0, 10).replace(/-/g, '')}-${Date.now().toString(36).toUpperCase()}`;

  const record = { id, createdAt, orderNo, customer: { name }, brand, brandName, denom, qty, pins, images: [], memo };

  if (payoutPendingImages.length) {
    const imageIds = payoutPendingImages.map((_, i) => `${id}-img${i + 1}`);
    submitBtn.disabled = true;
    try {
      await Promise.all(payoutPendingImages.map((file, i) => dbPutPayoutImage(imageIds[i], file)));
      record.images = imageIds;
    } catch (err) {
      await Promise.all(imageIds.map(iid => dbDeletePayoutImage(iid).catch(() => {})));
      showPayoutError('사진을 저장할 수 없습니다. 사진을 빼고 다시 시도해주세요.');
      submitBtn.disabled = false;
      return;
    } finally {
      submitBtn.disabled = false;
    }
  }

  await dbPutPayout(record);
  await reloadPayouts();
  payoutPendingImages = [];
  renderPayoutPreview();
  payoutOverlay.hidden = true;
  switchTab('payouts');
});

// ── 상세 / PDF ───────────────────────────────────────────────────────────────
const payoutDetailOverlay = document.getElementById('payoutDetailOverlay');
const payoutDetailBody    = document.getElementById('payoutDetailBody');
const payoutDetailUrls    = [];
let currentPayout = null;

function closePayoutDetail() {
  payoutDetailOverlay.hidden = true;
  revokeUrls(payoutDetailUrls);
  currentPayout = null;
}

function openPayoutDetail(p) {
  currentPayout = p;
  revokeUrls(payoutDetailUrls);
  const pins     = Array.isArray(p.pins)   ? p.pins   : [];
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
        <thead><tr><th>상품권</th><th class="num">액면가</th><th class="num">수량</th><th class="num">액면 합계</th></tr></thead>
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
        ? `<ol class="invoice-pins">${pins.map(x => `<li>${escapeHtml(x)}</li>`).join('')}</ol>`
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
    Promise.all(imageIds.map(id => dbGetPayoutImage(id).catch(() => null))).then(values => {
      const found = values.filter(Boolean);
      if (!box.isConnected) return;
      if (!found.length) {
        box.textContent = '저장된 사진을 불러올 수 없습니다.'; return;
      }
      found.forEach(value => {
        const src  = imageSrc(value, payoutDetailUrls);
        const link = document.createElement('a');
        link.href = src; link.target = '_blank'; link.rel = 'noopener';
        link.title = '클릭하면 원본 크기로 열립니다';
        const img = new Image();
        img.src = src; img.alt = '상품권 사진';
        link.appendChild(img); box.appendChild(link);
      });
    });
  }

  payoutDetailOverlay.hidden = false;
}

document.getElementById('payoutDetailClose').addEventListener('click', closePayoutDetail);
payoutDetailOverlay.addEventListener('click', e => { if (e.target === payoutDetailOverlay) closePayoutDetail(); });

document.getElementById('payoutDetailDelete').addEventListener('click', async () => {
  if (currentPayout && await deletePayout(currentPayout)) closePayoutDetail();
});

document.getElementById('payoutDetailPrint').addEventListener('click', async () => {
  const imgs = Array.from(payoutDetailBody.querySelectorAll('img'));
  await Promise.all(imgs.map(img => img.complete ? null : new Promise(r => { img.onload = r; img.onerror = r; })));
  const prevTitle = document.title;
  document.title = `지급내역서_${currentPayout ? currentPayout.id : ''}`;
  const restore = () => { document.title = prevTitle; window.removeEventListener('afterprint', restore); };
  window.addEventListener('afterprint', restore);
  window.print();
});

// ── 초기화 ───────────────────────────────────────────────────────────────────
(async () => {
  // 시드 데이터: DB가 비어있을 때만 삽입
  if (typeof PAYOUT_SEED !== 'undefined') {
    const count = await dbCountPayouts();
    if (count === 0) {
      for (const record of PAYOUT_SEED) {
        await dbPutPayout(record);
      }
      // 시드 이미지 저장 (권종별 이미지 6장 → 396개 imgId에 매핑)
      if (typeof PAYOUT_SEED_IMG_BY_DENOM !== 'undefined' && typeof PAYOUT_SEED_IMGID_DENOM !== 'undefined') {
        const blobCache = {};
        for (const [imgId, denom] of Object.entries(PAYOUT_SEED_IMGID_DENOM)) {
          try {
            if (!blobCache[denom]) {
              const resp = await fetch(PAYOUT_SEED_IMG_BY_DENOM[denom]);
              blobCache[denom] = await resp.blob();
            }
            await dbPutPayoutImage(imgId, blobCache[denom]);
          } catch (e) { /* 무시 */ }
        }
      }
    }
  }
  await reloadPayouts();
  renderPayouts();
})();
