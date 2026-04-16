const router = require('express').Router();
const auth = require('../middleware/auth');
const pool = require('../config/db');

router.post('/create', auth, async (req, res) => {
  const { account_id, recipient_account_id, amount, frequency,
          next_execution, end_date, label, schedule_type } = req.body;
  try {
    const r = await pool.query(
      `INSERT INTO scheduled_transactions
         (account_id, recipient_account_id, amount, frequency,
          next_execution, end_date, label, schedule_type)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [account_id, recipient_account_id, amount, frequency,
       next_execution, end_date || null, label, schedule_type || 'FIXED_RECURRING']
    );
    res.json(r.rows[0]);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.get('/my-schedules', auth, async (req, res) => {
  try {
    const accs = await pool.query(
      'SELECT account_id FROM accounts WHERE customer_id=$1',
      [req.user.customer_id]
    );
    const ids = accs.rows.map(a => a.account_id);
    const r = await pool.query(
      `SELECT * FROM scheduled_transactions
       WHERE account_id=ANY($1) ORDER BY created_at DESC`,
      [ids]
    );
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/cancel/:schedule_id', auth, async (req, res) => {
  try {
    await pool.query(
      `UPDATE scheduled_transactions SET status='CANCELLED'
       WHERE schedule_id=$1`,
      [req.params.schedule_id]
    );
    res.json({ success: true });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

module.exports = router;