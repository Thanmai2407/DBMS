const router = require('express').Router();
const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

router.post('/register', async (req, res) => {
  const { name, email, phone, password } = req.body;
  try {
    const hash = await bcrypt.hash(password, 10);
    const cust = await pool.query(
      `INSERT INTO customers (name,email,phone,password_hash,kyc_status)
       VALUES ($1,$2,$3,$4,'VERIFIED') RETURNING *`,
      [name, email, phone, hash]
    );
    await pool.query(
      'INSERT INTO accounts (customer_id, account_type) VALUES ($1,$2)',
      [cust.rows[0].customer_id, 'SAVINGS']
    );
    const token = jwt.sign(
      { customer_id: cust.rows[0].customer_id },
      process.env.JWT_SECRET, { expiresIn: '7d' }
    );
    res.json({ token, customer: cust.rows[0] });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const res2 = await pool.query('SELECT * FROM customers WHERE email=$1', [email]);
    if (!res2.rows.length) return res.status(401).json({ error: 'Invalid credentials' });
    const ok = await bcrypt.compare(password, res2.rows[0].password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign(
      { customer_id: res2.rows[0].customer_id },
      process.env.JWT_SECRET, { expiresIn: '7d' }
    );
    res.json({ token, customer: res2.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;