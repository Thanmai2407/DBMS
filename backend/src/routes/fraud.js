const router = require('express').Router();
const auth = require('../middleware/auth');
const pool = require('../config/db');

router.get('/flags', auth, async (req, res) => {
  try {
    const accs = await pool.query(
      'SELECT account_id FROM accounts WHERE customer_id=$1',
      [req.user.customer_id]
    );
    const ids = accs.rows.map(a => a.account_id);
    const r = await pool.query(
      `SELECT ff.*, t.amount, t.description, t.initiated_at
       FROM fraud_flags ff
       LEFT JOIN transactions t ON ff.transaction_id=t.transaction_id
       WHERE ff.account_id=ANY($1)
       ORDER BY ff.created_at DESC`,
      [ids]
    );
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/summary', auth, async (req, res) => {
  try {
    const accs = await pool.query(
      'SELECT account_id FROM accounts WHERE customer_id=$1',
      [req.user.customer_id]
    );
    const ids = accs.rows.map(a => a.account_id);
    const r = await pool.query(
      'SELECT * FROM fraud_summary WHERE account_id=ANY($1)',
      [ids]
    );
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/resolve/:flag_id', auth, async (req, res) => {
  try {
    await pool.query(
      `UPDATE fraud_flags SET status='RESOLVED' WHERE flag_id=$1`,
      [req.params.flag_id]
    );
    res.json({ success: true });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

module.exports = router;