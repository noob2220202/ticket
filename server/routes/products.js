const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/', (req, res) => {
  const products = db
    .prepare('SELECT * FROM products WHERE active = 1 ORDER BY sort_order ASC')
    .all();

  res.json(
    products.map((p) => ({
      id: p.id,
      category: p.category,
      name: p.name,
      denom: p.denom,
      discount: p.discount,
      price: p.price,
      brandClass: p.brand_class,
      brandLabel: p.brand_label,
    }))
  );
});

module.exports = router;
