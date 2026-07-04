const CART_KEY = 'kk_cart';
const ORDERS_KEY = 'kk_orders';

function getCart() {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY)) || [];
  } catch (e) {
    return [];
  }
}

function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  renderCartCount();
}

function salePrice(denom, discount) {
  return Math.round((denom * (1 - discount / 100)) / 10) * 10;
}

function addToCart(item, qty) {
  const cart = getCart();
  const existing = cart.find((c) => c.id === item.id);
  if (existing) {
    existing.qty += qty;
  } else {
    cart.push({ ...item, qty });
  }
  saveCart(cart);
}

function removeFromCart(id) {
  saveCart(getCart().filter((c) => c.id !== id));
}

function updateCartQty(id, qty) {
  const cart = getCart();
  const item = cart.find((c) => c.id === id);
  if (!item) return;
  item.qty = Math.max(1, qty);
  saveCart(cart);
}

function clearCart() {
  saveCart([]);
}

function cartCount() {
  return getCart().reduce((sum, c) => sum + c.qty, 0);
}

function cartTotal() {
  return getCart().reduce((sum, c) => sum + c.price * c.qty, 0);
}

function getOrders() {
  try {
    return JSON.parse(localStorage.getItem(ORDERS_KEY)) || [];
  } catch (e) {
    return [];
  }
}

function saveOrder(order) {
  const orders = getOrders();
  orders.unshift(order);
  localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
}

function renderCartCount() {
  const badge = document.getElementById('cartCount');
  if (!badge) return;
  const count = cartCount();
  badge.textContent = count;
  badge.hidden = count === 0;
}

document.addEventListener('DOMContentLoaded', renderCartCount);
