function formatWon(n) {
  return n.toLocaleString('ko-KR') + '원';
}

function formatDate(iso) {
  const d = new Date(iso.replace(' ', 'T') + 'Z');
  return d.toLocaleString('ko-KR');
}

function renderProfile(session) {
  const profileInfo = document.getElementById('profileInfo');
  profileInfo.innerHTML = `
    <div><dt>아이디</dt><dd>${session.userId}</dd></div>
    <div><dt>이름</dt><dd>${session.name}</dd></div>
    <div><dt>휴대폰번호</dt><dd>${session.phone}</dd></div>
    <div><dt>이메일</dt><dd>${session.email}</dd></div>
  `;
}

async function renderOrderHistory() {
  const body = document.getElementById('orderHistoryBody');
  const table = document.getElementById('orderHistoryTable');
  const empty = document.getElementById('orderHistoryEmpty');

  let orders = [];
  try {
    orders = await api.getOrders();
  } catch (e) {
    orders = [];
  }

  if (orders.length === 0) {
    table.hidden = true;
    empty.hidden = false;
    return;
  }

  table.hidden = false;
  empty.hidden = true;

  body.innerHTML = orders
    .map(
      (order) => `
    <tr>
      <td>${order.id}</td>
      <td>${formatDate(order.createdAt)}</td>
      <td>${order.items.map((i) => `${i.name} x${i.qty}`).join(', ')}</td>
      <td>${formatWon(order.total)}</td>
      <td>${order.status}</td>
    </tr>
  `
    )
    .join('');
}

document.addEventListener('DOMContentLoaded', async () => {
  const session = await renderAuthUI();
  if (!session) {
    sessionStorage.setItem('kk_redirect', 'mypage.html');
    window.location.href = 'login.html';
    return;
  }
  renderProfile(session);
  renderOrderHistory();
});
