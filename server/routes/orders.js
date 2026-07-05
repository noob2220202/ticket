const express = require('express');
const crypto = require('crypto');
const db = require('../db');
const requireAuth = require('../middleware/requireAuth');

const router = express.Router();

const PHONE_RE = /^01[0-9]-?[0-9]{3,4}-?[0-9]{4}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DELIVERY_METHODS = new Set(['kakao', 'sms', 'email']);

function generateOrderId() {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `ORD-${stamp}-${rand}`;
}

function serializeOrder(order, items) {
  return {
    id: order.id,
    status: order.status,
    total: order.total,
    createdAt: order.created_at,
    buyer: {
      name: order.buyer_name,
      phone: order.buyer_phone,
      email: order.buyer_email,
      deliveryMethod: order.delivery_method,
      memo: order.memo,
    },
    items: items.map((i) => ({ productId: i.product_id, name: i.name, price: i.price, qty: i.qty })),
  };
}

router.post('/', requireAuth, (req, res) => {
  const { items, buyer } = req.body || {};

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: '주문할 상품이 없습니다.' });
  }
  if (!buyer || typeof buyer !== 'object') {
    return res.status(400).json({ error: '수령 정보를 입력해주세요.' });
  }

  const name = typeof buyer.name === 'string' ? buyer.name.trim() : '';
  const phone = typeof buyer.phone === 'string' ? buyer.phone.trim() : '';
  const email = typeof buyer.email === 'string' ? buyer.email.trim() : '';
  const deliveryMethod = buyer.deliveryMethod;
  const memo = typeof buyer.memo === 'string' ? buyer.memo.trim().slice(0, 300) : '';

  if (!name) return res.status(400).json({ error: '받는 분 성함을 입력해주세요.' });
  if (!PHONE_RE.test(phone)) return res.status(400).json({ error: '연락처 형식이 올바르지 않습니다.' });
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: '이메일 형식이 올바르지 않습니다.' });
  if (!DELIVERY_METHODS.has(deliveryMethod)) {
    return res.status(400).json({ error: '수령 방법을 선택해주세요.' });
  }

  const getProduct = db.prepare('SELECT * FROM products WHERE id = ? AND active = 1');
  const resolvedItems = [];

  for (const raw of items) {
    const product = getProduct.get(raw && raw.id);
    const qty = Number(raw && raw.qty);
    if (!product || !Number.isInteger(qty) || qty < 1 || qty > 99) {
      return res.status(400).json({ error: '상품 정보가 올바르지 않습니다.' });
    }
    resolvedItems.push({ product, qty });
  }

  const total = resolvedItems.reduce((sum, i) => sum + i.product.price * i.qty, 0);
  const orderId = generateOrderId();

  const insertOrder = db.prepare(`
    INSERT INTO orders (id, user_id, total, status, buyer_name, buyer_phone, buyer_email, delivery_method, memo)
    VALUES (@id, @userId, @total, '접수완료', @name, @phone, @email, @deliveryMethod, @memo)
  `);
  const insertItem = db.prepare(`
    INSERT INTO order_items (order_id, product_id, name, price, qty)
    VALUES (@orderId, @productId, @name, @price, @qty)
  `);

  const createOrder = db.transaction(() => {
    insertOrder.run({
      id: orderId,
      userId: req.session.userId,
      total,
      name,
      phone,
      email,
      deliveryMethod,
      memo,
    });
    resolvedItems.forEach(({ product, qty }) => {
      insertItem.run({ orderId, productId: product.id, name: product.name, price: product.price, qty });
    });
  });

  createOrder();

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  const orderItems = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId);

  res.status(201).json(serializeOrder(order, orderItems));
});

router.get('/', requireAuth, (req, res) => {
  const orders = db
    .prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC')
    .all(req.session.userId);

  const itemsByOrder = db.prepare('SELECT * FROM order_items WHERE order_id = ?');

  res.json(orders.map((order) => serializeOrder(order, itemsByOrder.all(order.id))));
});

router.get('/:id', requireAuth, (req, res) => {
  const order = db
    .prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.session.userId);

  if (!order) return res.status(404).json({ error: '주문을 찾을 수 없습니다.' });

  const orderItems = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
  res.json(serializeOrder(order, orderItems));
});

module.exports = router;
