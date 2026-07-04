const session = getSession();
if (!session) {
  sessionStorage.setItem('kk_redirect', 'checkout.html');
  window.location.href = 'login.html';
}

const cart = getCart();
if (cart.length === 0) {
  window.location.href = 'cart.html';
}

function formatWon(n) {
  return n.toLocaleString('ko-KR') + '원';
}

function renderOrder() {
  const orderBody = document.getElementById('orderBody');
  orderBody.innerHTML = cart
    .map(
      (item) => `
    <tr>
      <td>${item.name}</td>
      <td>${formatWon(item.price)}</td>
      <td>${item.qty}</td>
      <td>${formatWon(item.price * item.qty)}</td>
    </tr>
  `
    )
    .join('');
  document.getElementById('orderTotal').textContent = formatWon(cartTotal());
}

function prefillBuyer() {
  const member = findMember(session.userId);
  if (!member) return;
  document.getElementById('buyerName').value = member.name || '';
  document.getElementById('buyerPhone').value = member.phone || '';
  document.getElementById('buyerEmail').value = member.email || '';
}

const checkoutForm = document.getElementById('checkoutForm');
const formMessage = document.getElementById('formMessage');

function showMessage(text, type) {
  formMessage.textContent = text;
  formMessage.hidden = false;
  formMessage.className = 'form-message ' + type;
}

checkoutForm.addEventListener('submit', (e) => {
  e.preventDefault();

  if (!checkoutForm.checkValidity()) {
    checkoutForm.reportValidity();
    return;
  }

  const order = {
    id: 'ORD' + Date.now(),
    userId: session.userId,
    createdAt: new Date().toISOString(),
    status: '접수완료',
    items: cart,
    total: cartTotal(),
    buyer: {
      name: document.getElementById('buyerName').value.trim(),
      phone: document.getElementById('buyerPhone').value.trim(),
      email: document.getElementById('buyerEmail').value.trim(),
      deliveryMethod: document.getElementById('deliveryMethod').value,
      memo: document.getElementById('memo').value.trim(),
    },
  };

  saveOrder(order);
  clearCart();

  sessionStorage.setItem('kk_last_order', order.id);
  showMessage('주문이 접수되었습니다. 잠시 후 이동합니다.', 'success');

  setTimeout(() => {
    window.location.href = 'order-complete.html';
  }, 700);
});

document.addEventListener('DOMContentLoaded', () => {
  renderOrder();
  prefillBuyer();
});
