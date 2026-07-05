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

function prefillBuyer(session) {
  document.getElementById('buyerName').value = session.name || '';
  document.getElementById('buyerPhone').value = session.phone || '';
  document.getElementById('buyerEmail').value = session.email || '';
}

const checkoutForm = document.getElementById('checkoutForm');
const formMessage = document.getElementById('formMessage');

function showMessage(text, type) {
  formMessage.textContent = text;
  formMessage.hidden = false;
  formMessage.className = 'form-message ' + type;
}

checkoutForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  if (!checkoutForm.checkValidity()) {
    checkoutForm.reportValidity();
    return;
  }

  const submitBtn = checkoutForm.querySelector('button[type=submit]');
  submitBtn.disabled = true;

  const payload = {
    items: cart.map((item) => ({ id: item.id, qty: item.qty })),
    buyer: {
      name: document.getElementById('buyerName').value.trim(),
      phone: document.getElementById('buyerPhone').value.trim(),
      email: document.getElementById('buyerEmail').value.trim(),
      deliveryMethod: document.getElementById('deliveryMethod').value,
      memo: document.getElementById('memo').value.trim(),
    },
  };

  try {
    const order = await api.createOrder(payload);
    clearCart();
    sessionStorage.setItem('kk_last_order', order.id);
    showMessage('주문이 접수되었습니다. 잠시 후 이동합니다.', 'success');

    setTimeout(() => {
      window.location.href = 'order-complete.html';
    }, 700);
  } catch (err) {
    if (err.status === 401) {
      sessionStorage.setItem('kk_redirect', 'checkout.html');
      window.location.href = 'login.html';
      return;
    }
    showMessage(err.message, 'error');
    submitBtn.disabled = false;
  }
});

document.addEventListener('DOMContentLoaded', async () => {
  const session = await renderAuthUI();
  if (!session) {
    sessionStorage.setItem('kk_redirect', 'checkout.html');
    window.location.href = 'login.html';
    return;
  }
  renderOrder();
  prefillBuyer(session);
});
