const cartBody = document.getElementById('cartBody');
const cartWrap = document.getElementById('cartWrap');
const cartEmpty = document.getElementById('cartEmpty');
const cartTotalEl = document.getElementById('cartTotal');

function formatWon(n) {
  return n.toLocaleString('ko-KR') + '원';
}

function renderCart() {
  const cart = getCart();

  if (cart.length === 0) {
    cartWrap.hidden = true;
    cartEmpty.hidden = false;
    return;
  }

  cartWrap.hidden = false;
  cartEmpty.hidden = true;

  cartBody.innerHTML = cart
    .map(
      (item) => `
    <tr data-id="${item.id}">
      <td>${item.name}</td>
      <td>${formatWon(item.price)}</td>
      <td>
        <input type="number" class="qty-input" min="1" value="${item.qty}" data-qty="${item.id}">
      </td>
      <td>${formatWon(item.price * item.qty)}</td>
      <td><button type="button" class="remove-btn" data-remove="${item.id}">삭제</button></td>
    </tr>
  `
    )
    .join('');

  cartTotalEl.textContent = formatWon(cartTotal());
}

cartBody.addEventListener('change', (e) => {
  if (e.target.matches('[data-qty]')) {
    updateCartQty(e.target.dataset.qty, Number(e.target.value));
    renderCart();
  }
});

cartBody.addEventListener('click', (e) => {
  if (e.target.matches('[data-remove]')) {
    removeFromCart(e.target.dataset.remove);
    renderCart();
  }
});

const clearCartBtn = document.getElementById('clearCartBtn');
if (clearCartBtn) {
  clearCartBtn.addEventListener('click', () => {
    if (confirm('장바구니를 비우시겠습니까?')) {
      clearCart();
      renderCart();
    }
  });
}

const orderBtn = document.getElementById('orderBtn');
if (orderBtn) {
  orderBtn.addEventListener('click', async () => {
    if (getCart().length === 0) return;
    orderBtn.disabled = true;

    let session = null;
    try {
      session = await api.getMe();
    } catch (e) {
      session = null;
    }

    if (!session) {
      sessionStorage.setItem('kk_redirect', 'checkout.html');
      window.location.href = 'login.html';
      return;
    }
    window.location.href = 'checkout.html';
  });
}

document.addEventListener('DOMContentLoaded', renderCart);
