const router = require('express').Router();
const auth = require('../middleware/auth');
const pool = require('../config/db');
const { disburseLoan, payEMI } = require('../services/loanService');

router.post('/disburse', auth, async (req, res) => {
  const { account_id, principal, annual_rate, tenure_months } = req.body;
  try {
    const r = await disburseLoan({
      accountId: account_id,
      principal: parseFloat(principal),
      annualRate: parseFloat(annual_rate),
      tenureMonths: parseInt(tenure_months),
      initiatedBy: req.user.customer_id
    });
    res.json(r);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.get('/my-loans', auth, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT ls.* FROM loan_summary ls
       JOIN accounts a ON ls.account_id=a.account_id
       WHERE a.customer_id=$1`,
      [req.user.customer_id]
    );
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/schedule/:loan_id', auth, async (req, res) => {
  try {
    const r = await pool.query(
      'SELECT * FROM loan_schedule WHERE loan_id=$1 ORDER BY emi_number',
      [req.params.loan_id]
    );
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/pay-emi', auth, async (req, res) => {
  const { loan_id, account_id } = req.body;
  try {
    const r = await payEMI(loan_id, account_id, req.user.customer_id);
    res.json(r);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

module.exports = router;