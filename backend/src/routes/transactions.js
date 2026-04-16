const router = require('express').Router();
const auth = require('../middleware/auth');
const idempotency = require('../middleware/idempotency');
const pool = require('../config/db');
const { executeTransfer, deposit } = require('../services/transactionService');

router.get('/', auth, async (req, res) => {
  try {
    const accs = await pool.query(
      'SELECT account_id FROM accounts WHERE customer_id=$1',
      [req.user.customer_id]
    );
    const ids = accs.rows.map(a => a.account_id);
    if (!ids.length) return res.json([]);
    const r = await pool.query(
      `SELECT * FROM transaction_history
       WHERE account_id=ANY($1) ORDER BY created_at DESC LIMIT 100`,
      [ids]
    );
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/transfer', auth, idempotency, async (req, res) => {
  const { from_account_id, to_account_id, amount, description } = req.body;
  try {
    const tx = await executeTransfer({
      fromAccountId: from_account_id,
      toAccountId: to_account_id,
      amount: parseFloat(amount),
      description,
      initiatedBy: req.user.customer_id,
      idempotencyKey: req.idempotencyKey
    });
    res.json({ success: true, transaction: tx });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.post('/deposit', auth, async (req, res) => {
  const { account_id, amount, description } = req.body;
  try {
    const tx = await deposit(account_id, parseFloat(amount), description, req.user.customer_id);
    res.json({ success: true, transaction: tx });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// Time-travel balance query
router.get('/balance-at', auth, async (req, res) => {
  const { account_id, timestamp } = req.query;
  try {
    const r = await pool.query(
      `SELECT COALESCE(
         SUM(CASE WHEN direction='CREDIT' THEN amount ELSE -amount END), 0
       ) AS balance_at_time
       FROM journal
       WHERE account_id=$1 AND created_at <= $2`,
      [account_id, timestamp]
    );
    res.json({ balance: r.rows[0].balance_at_time, at: timestamp });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Double-entry integrity check
router.get('/integrity', auth, async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM double_entry_check');
    res.json({
      result: r.rows.length === 0 ? 'PASS' : 'FAIL',
      violations: r.rows
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Full audit trail for one transaction
router.get('/audit/:tx_id', auth, async (req, res) => {
  try {
    const journal = await pool.query(
      'SELECT * FROM journal WHERE transaction_id=$1 ORDER BY created_at',
      [req.params.tx_id]
    );
    const tx = await pool.query(
      'SELECT * FROM transactions WHERE transaction_id=$1',
      [req.params.tx_id]
    );
    const wal = await pool.query(
      'SELECT * FROM wal_log WHERE transaction_id=$1',
      [req.params.tx_id]
    );
    res.json({ transaction: tx.rows[0], journal: journal.rows, wal: wal.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;