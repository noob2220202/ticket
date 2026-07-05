const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const db = require('../db');

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' },
});

const USER_ID_RE = /^[a-zA-Z0-9]{4,20}$/;
const PHONE_RE = /^01[0-9]-?[0-9]{3,4}-?[0-9]{4}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function toPublicUser(user) {
  return { userId: user.user_id, name: user.name, phone: user.phone, email: user.email };
}

router.post('/signup', authLimiter, (req, res) => {
  const { userId, password, name, phone, email } = req.body || {};

  if (typeof userId !== 'string' || !USER_ID_RE.test(userId)) {
    return res.status(400).json({ error: '아이디는 영문/숫자 4~20자로 입력해주세요.' });
  }
  if (typeof password !== 'string' || password.length < 6 || password.length > 72) {
    return res.status(400).json({ error: '비밀번호는 6자 이상으로 입력해주세요.' });
  }
  if (typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ error: '이름을 입력해주세요.' });
  }
  if (typeof phone !== 'string' || !PHONE_RE.test(phone)) {
    return res.status(400).json({ error: '휴대폰번호 형식이 올바르지 않습니다.' });
  }
  if (typeof email !== 'string' || !EMAIL_RE.test(email)) {
    return res.status(400).json({ error: '이메일 형식이 올바르지 않습니다.' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE user_id = ?').get(userId);
  if (existing) {
    return res.status(409).json({ error: '이미 사용 중인 아이디입니다.' });
  }

  const passwordHash = bcrypt.hashSync(password, 10);

  db.prepare(
    'INSERT INTO users (user_id, password_hash, name, phone, email) VALUES (?, ?, ?, ?, ?)'
  ).run(userId, passwordHash, name.trim(), phone.trim(), email.trim());

  res.status(201).json({ ok: true });
});

router.post('/login', authLimiter, (req, res) => {
  const { userId, password } = req.body || {};

  if (typeof userId !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: '아이디와 비밀번호를 입력해주세요.' });
  }

  const user = db.prepare('SELECT * FROM users WHERE user_id = ?').get(userId);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: '아이디 또는 비밀번호가 일치하지 않습니다.' });
  }

  req.session.regenerate((err) => {
    if (err) return res.status(500).json({ error: '로그인 중 오류가 발생했습니다.' });
    req.session.userId = user.id;
    res.json(toPublicUser(user));
  });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.json({ ok: true });
  });
});

router.get('/me', (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: '로그인이 필요합니다.' });
  }
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId);
  if (!user) return res.status(401).json({ error: '로그인이 필요합니다.' });
  res.json(toPublicUser(user));
});

module.exports = router;
