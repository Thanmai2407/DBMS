const router = require('express').Router();
const auth = require('../middleware/auth');
const pool = require('../config/db');
const { createVault, getVaultStatus, createRoundupRule, createSplitRule } = require('../services/vaultService');

router.post('/create', auth, async (req, res) => {
  const { vault_type, unlock_date, target_amount, penalty_pct } = req.body;
  try {
    const v = await createVault({
      customerId: req.user.customer_id,
      vaultType: vault_type,
      unlockDate: unlock_date,
      targetAmount: target_amount,
      penaltyPct: penalty_pct
    });
    res.json(v);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.get('/status/:account_id', auth, async (req, res) => {
  try {
    const r = await getVaultStatus(req.params.account_id);
    res.json(r);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.get('/my-vaults', auth, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT a.*, bc.balance FROM accounts a
       JOIN balance_cache bc ON a.account_id=bc.account_id
       WHERE a.customer_id=$1 AND a.account_type='VAULT'`,
      [req.user.customer_id]
    );
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/roundup-rule', auth, async (req, res) => {
  const { source_account_id, vault_account_id, category } = req.body;
  try {
    const r = await createRoundupRule(source_account_id, vault_account_id, category);
    res.json(r);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.post('/split-rule', auth, async (req, res) => {
  const { account_id, min_trigger_amount, legs } = req.body;
  try {
    const r = await createSplitRule(account_id, min_trigger_amount, legs);
    res.json(r);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

module.exports = router;