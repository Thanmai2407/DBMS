const router = require('express').Router();
const auth = require('../middleware/auth');
const pool = require('../config/db');
const { requestReversal, resolveReversal } = require('../services/reversalService');

router.post('/request', auth, async (req, res) => {
  try {
    const r = await requestReversal(req.body.transaction_id, req.user.customer_id, req.body.reason);
    res.json(r);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.post('/resolve', auth, async (req, res) => {
  try {
    const r = await resolveReversal(req.body.request_id, req.body.resolution, req.user.customer_id);
    res.json(r);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.get('/pending', auth, async (req, res) => {
  try {
    const accs = await pool.query(
      'SELECT account_id FROM accounts WHERE customer_id=$1',
      [req.user.customer_id]
    );
    const ids = accs.rows.map(a => a.account_id);
    const r = await pool.query(
      `SELECT rr.*, t.amount, t.description
       FROM reversal_requests rr
       JOIN transactions t ON rr.original_transaction_id=t.transaction_id
       JOIN journal j ON t.transaction_id=j.transaction_id
       WHERE j.account_id=ANY($1) AND rr.status='PENDING'
       GROUP BY rr.request_id, t.amount, t.description`,
      [ids]
    );
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/history', auth, async (req, res) => {
  try {
    const accs = await pool.query(
      'SELECT account_id FROM accounts WHERE customer_id=$1',
      [req.user.customer_id]
    );
    const ids = accs.rows.map(a => a.account_id);
    const r = await pool.query(
      `SELECT rr.*, t.amount, t.description
       FROM reversal_requests rr
       JOIN transactions t ON rr.original_transaction_id=t.transaction_id
       JOIN journal j ON t.transaction_id=j.transaction_id
       WHERE j.account_id=ANY($1)
       GROUP BY rr.request_id, t.amount, t.description
       ORDER BY rr.requested_at DESC`,
      [ids]
    );
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;