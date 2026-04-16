const router = require('express').Router();
const auth = require('../middleware/auth');
const pool = require('../config/db');

router.get('/', auth, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT a.*, bc.balance FROM accounts a
       JOIN balance_cache bc ON a.account_id=bc.account_id
       WHERE a.customer_id=$1 ORDER BY a.created_at`,
      [req.user.customer_id]
    );
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/create', auth, async (req, res) => {
  const { account_type } = req.body;
  try {
    const r = await pool.query(
      `INSERT INTO accounts (customer_id, account_type) VALUES ($1,$2) RETURNING *`,
      [req.user.customer_id, account_type]
    );
    res.json(r.rows[0]);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.get('/notifications', auth, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT * FROM notifications WHERE customer_id=$1
       ORDER BY created_at DESC LIMIT 30`,
      [req.user.customer_id]
    );
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/notifications/read', auth, async (req, res) => {
  try {
    await pool.query(
      'UPDATE notifications SET is_read=TRUE WHERE customer_id=$1',
      [req.user.customer_id]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/budget', auth, async (req, res) => {
  const { account_id, category, monthly_limit } = req.body;
  try {
    const r = await pool.query(
      `INSERT INTO budgets (account_id, category, monthly_limit)
       VALUES ($1,$2,$3)
       ON CONFLICT (account_id, category)
       DO UPDATE SET monthly_limit=$3 RETURNING *`,
      [account_id, category, monthly_limit]
    );
    res.json(r.rows[0]);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.get('/budgets/:account_id', auth, async (req, res) => {
  try {
    const r = await pool.query(
      'SELECT * FROM budgets WHERE account_id=$1',
      [req.params.account_id]
    );
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;