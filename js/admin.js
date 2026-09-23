// 관리자 페이지 로직. 실 결제/DB 없이 js/orders-data.js 의 데모 데이터를
// 화면에 렌더링하고, 인보이스 상세 + PDF(인쇄) 내보내기를 제공합니다.
//
// 주의: 아래 비밀번호 게이트는 정적 페이지에서 접근을 헷갈리지 않게 막는
// 용도일 뿐, 소스에 그대로 노출되므로 실제 보안 수단이 아닙니다.
// 진짜 운영 단계에서는 서버 인증으로 반드시 교체해야 합니다.
const ADMIN_PASSWORD = 'bokdream2026';

// sessionStorage가 막힌 환경(카카오톡 인앱브라우저 등)에서 예외가 터져
// 폼 제출 리스너 등록 자체가 실행되지 못하는 일이 없도록, 접근을
// try/catch로 감싸고 실패 시 메모리로 폴백합니다.
function safeSessionStorage() {
  let store = null;
  try {
    store = window.sessionStorage;
    const testKey = '__admin_test__';
    store.setItem(testKey, '1');
    store.removeItem(testKey);
  } catch (e) {
    store = null;
  }

  const memory = {};

  return {
    getItem(key) {
      if (store) {
        try {
          return store.getItem(key);
        } catch (e) {
          // 폴백
        }
      }
      return Object.prototype.hasOwnProperty.call(memory, key) ? memory[key] : null;
    },
    setItem(key, value) {
      if (store) {
        try {
          store.setItem(key, value);
          return;
        } catch (e) {
          // 폴백
        }
      }
      memory[key] = value;
    },
    removeItem(key) {
      if (store) {
        try {
          store.removeItem(key);
          return;
        } catch (e) {
          // 폴백
        }
      }
      delete memory[key];
    },
  };
}

const adminStorage = safeSessionStorage();

const gate = document.getElementById('adminGate');
const dashboard = document.getElementById('adminDashboard');
const gateForm = document.getElementById('adminGateForm');
const gateInput = document.getElementById('adminGatePw');
const gateError = document.getElementById('adminGateError');

function isAuthed() {
  return adminStorage.getItem('adminAuthed') === '1';
}

function showDashboard() {
  gate.hidden = true;
  dashboard.hidden = false;
  renderAll();
}

if (isAuthed()) {
  showDashboard();
}

if (gateForm) {
  gateForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (gateInput.value === ADMIN_PASSWORD) {
      adminStorage.setItem('adminAuthed', '1');
      gateError.textContent = '';
      showDashboard();
    } else {
      gateError.textContent = '비밀번호가 올바르지 않습니다.';
    }
  });
}

const logoutBtn = document.getElementById('adminLogout');
if (logoutBtn) {
  logoutBtn.addEventListener('click', () => {
    adminStorage.removeItem('adminAuthed');
    dashboard.hidden = true;
    gate.hidden = false;
    gateInput.value = '';
  });
}

// ---- 데이터 렌더링 ----

const won = (n) => n.toLocaleString('ko-KR') + '원';
const pct = (r) => (r * 100).toFixed(1) + '%';

function fmtDate(iso) {
  const d = new Date(iso);
  return d.toLocaleString('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

const BRAND_LABEL = {
  lotte: '롯데백화점', shinsegae: '신세계백화점', hyundai: '현대백화점',
  galleria: '갤러리아', guk: '국민관광', keumkang: '금강제화', oil: '주유상품권',
};

let currentOrders = typeof DEMO_ORDERS !== 'undefined' ? DEMO_ORDERS : [];

function renderStats(orders) {
  const total = orders.length;
  const completed = orders.filter((o) => o.status === '완료').length;
  const pending = orders.filter((o) => o.status === '입금대기' || o.status === '확인중').length;
  const totalAmount = orders
    .filter((o) => o.status === '완료')
    .reduce((sum, o) => sum + o.settlementAmount, 0);

  document.getElementById('statTotal').textContent = total + '건';
  document.getElementById('statCompleted').textContent = completed + '건';
  document.getElementById('statPending').textContent = pending + '건';
  document.getElementById('statAmount').textContent = won(totalAmount);
}

function renderTable(orders) {
  const tbody = document.getElementById('orderTableBody');
  const empty = document.getElementById('orderEmpty');
  tbody.innerHTML = '';

  if (orders.length === 0) {
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  orders.forEach((o) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${o.id}</td>
      <td>${fmtDate(o.createdAt)}</td>
      <td><span class="badge-type">${o.type}</span></td>
      <td>${BRAND_LABEL[o.brand] || o.brandName}</td>
      <td>${won(o.denom)} × ${o.qty}</td>
      <td>${won(o.settlementAmount)}</td>
      <td>${o.customer.name} (${o.customer.phone})</td>
      <td><span class="badge-status badge-${o.status}">${o.status}</span></td>
    `;
    tr.addEventListener('click', () => openInvoice(o));
    tbody.appendChild(tr);
  });
}

function applyFilters() {
  const brand = document.getElementById('filterBrand').value;
  const status = document.getElementById('filterStatus').value;
  const type = document.getElementById('filterType').value;
  const keyword = document.getElementById('filterKeyword').value.trim().toLowerCase();

  const filtered = currentOrders.filter((o) => {
    if (brand !== 'all' && o.brand !== brand) return false;
    if (status !== 'all' && o.status !== status) return false;
    if (type !== 'all' && o.type !== type) return false;
    if (keyword) {
      const hay = `${o.id} ${o.invoiceNo} ${o.customer.name} ${o.brandName}`.toLowerCase();
      if (!hay.includes(keyword)) return false;
    }
    return true;
  });

  renderStats(filtered);
  renderTable(filtered);
}

function renderAll() {
  renderStats(currentOrders);
  renderTable(currentOrders);
}

['filterBrand', 'filterStatus', 'filterType'].forEach((id) => {
  const el = document.getElementById(id);
  if (el) el.addEventListener('change', applyFilters);
});
const kwInput = document.getElementById('filterKeyword');
if (kwInput) kwInput.addEventListener('input', applyFilters);

// ---- 인보이스 상세 ----

const overlay = document.getElementById('invoiceOverlay');
const invoiceBody = document.getElementById('invoiceBody');

function openInvoice(o) {
  const isBuy = o.type === '매입';
  const unitPrice = Math.round(o.settlementAmount / o.qty);

  invoiceBody.innerHTML = `
    <div class="invoice-doc-head">
      <div>
        <h2>${isBuy ? '매입' : '판매'} 인보이스</h2>
        <div class="invoice-no">${o.invoiceNo} · 발행일 ${fmtDate(o.createdAt)}</div>
      </div>
      <div class="invoice-brand">
        <strong>복드림 상품권</strong>
        사업자등록번호 623-70-00295<br>
        서울특별시 성동구 천호대로 430, 1층 103호(용답동)
      </div>
    </div>

    <div class="invoice-section">
      <h3>거래 정보</h3>
      <div class="invoice-grid">
        <div><dt>주문번호</dt><dd>${o.id}</dd></div>
        <div><dt>거래유형</dt><dd>${o.type}</dd></div>
        <div><dt>처리상태</dt><dd>${o.status}</dd></div>
        <div><dt>담당</dt><dd>${o.staff}</dd></div>
      </div>
    </div>

    <div class="invoice-section">
      <h3>고객 정보</h3>
      <div class="invoice-grid">
        <div><dt>고객명</dt><dd>${o.customer.name}</dd></div>
        <div><dt>연락처</dt><dd>${o.customer.phone}</dd></div>
        <div><dt>가입월</dt><dd>${o.customer.memberSince}</dd></div>
        <div><dt>결제수단</dt><dd>${o.paymentMethod}</dd></div>
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
            <th class="num">적용 할인율</th>
            <th class="num">건당 정산가</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>${o.brandName}</td>
            <td class="num">${won(o.denom)}</td>
            <td class="num">${o.qty}개</td>
            <td class="num">${pct(o.discountRate)}</td>
            <td class="num">${won(unitPrice)}</td>
          </tr>
        </tbody>
      </table>
      <div class="invoice-total">
        <span>액면 합계 ${won(o.faceTotal)}</span>
        <span>최종 ${isBuy ? '지급' : '결제'}액 <strong>${won(o.settlementAmount)}</strong></span>
      </div>
    </div>

    <div class="invoice-section">
      <h3>정산 계좌</h3>
      <div class="invoice-grid">
        <div><dt>은행</dt><dd>${o.bank}</dd></div>
        <div><dt>계좌번호</dt><dd>${o.accountMasked}</dd></div>
      </div>
    </div>

    <div class="invoice-memo">메모: ${o.memo}</div>
    <div class="invoice-footnote">※ 본 문서는 관리자 페이지 데모 데이터로 생성된 샘플 인보이스이며 실제 거래 증빙이 아닙니다.</div>
  `;

  overlay.hidden = false;
}

document.getElementById('invoiceClose').addEventListener('click', () => {
  overlay.hidden = true;
});
overlay.addEventListener('click', (e) => {
  if (e.target === overlay) overlay.hidden = true;
});
document.getElementById('invoicePrint').addEventListener('click', () => {
  window.print();
});
