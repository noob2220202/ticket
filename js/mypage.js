const mypageSession = getSession();
if (!mypageSession) {
  sessionStorage.setItem('kk_redirect', 'mypage.html');
  window.location.href = 'login.html';
}

function formatWon(n) {
  return n.toLocaleString('ko-KR') + '원';
}

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleString('ko-KR');
}

function renderProfile() {
  const member = findMember(mypageSession.userId);
  const profileInfo = document.getElementById('profileInfo');
  if (!member) return;

  profileInfo.innerHTML = `
    <div><dt>아이디</dt><dd>${member.userId}</dd></div>
    <div><dt>이름</dt><dd>${member.name}</dd></div>
    <div><dt>휴대폰번호</dt><dd>${member.phone}</dd></div>
    <div><dt>이메일</dt><dd>${member.email}</dd></div>
  `;
}

function renderOrderHistory() {
  const orders = getOrders().filter((o) => o.userId === mypageSession.userId);
  const body = document.getElementById('orderHistoryBody');
  const table = document.getElementById('orderHistoryTable');
  const empty = document.getElementById('orderHistoryEmpty');

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

document.addEventListener('DOMContentLoaded', () => {
  renderProfile();
  renderOrderHistory();
});
