const router = require('express').Router();
const auth = require('../middleware/auth');
const pool = require('../config/db');

router.get('/spending/:account_id', auth, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT category, total_spent, transaction_count
       FROM monthly_spend
       WHERE account_id=$1
       AND month = DATE_TRUNC('month', NOW())`,
      [req.params.account_id]
    );
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/budgets/:account_id', auth, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT b.category, b.monthly_limit,
              COALESCE(ms.total_spent, 0) AS spent,
              ROUND((COALESCE(ms.total_spent,0)/b.monthly_limit)*100,1) AS pct_used
       FROM budgets b
       LEFT JOIN monthly_spend ms
         ON b.account_id=ms.account_id
         AND b.category=ms.category
         AND ms.month=DATE_TRUNC('month',NOW())
       WHERE b.account_id=$1`,
      [req.params.account_id]
    );
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/forecast/:account_id', auth, async (req, res) => {
  try {
    const r = await pool.query(
      `WITH daily AS (
         SELECT sc.category,
                DATE(j.created_at) AS day,
                SUM(j.amount) AS day_total
         FROM journal j
         JOIN spending_categories sc ON j.transaction_id=sc.transaction_id
         WHERE j.account_id=$1 AND j.direction='DEBIT'
         AND j.created_at >= NOW() - INTERVAL '30 days'
         GROUP BY sc.category, DATE(j.created_at)
       )
       SELECT category,
              ROUND(AVG(day_total),2) AS daily_avg,
              ROUND(AVG(day_total)*30,2) AS projected_monthly,
              ROUND(AVG(day_total)*
                (DATE_PART('days', DATE_TRUNC('month',NOW()) +
                 INTERVAL '1 month' - NOW())),2) AS remaining_projected
       FROM daily
       GROUP BY category`,
      [req.params.account_id]
    );
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Window function — rolling 7-day average spend
router.get('/rolling/:account_id', auth, async (req, res) => {
  try {
    const r = await pool.query(
      `WITH daily_spend AS (
         SELECT DATE(created_at) AS day, SUM(amount) AS total
         FROM journal
         WHERE account_id=$1 AND direction='DEBIT'
         AND created_at >= NOW() - INTERVAL '60 days'
         GROUP BY DATE(created_at)
       )
       SELECT day, total,
              ROUND(AVG(total) OVER (
                ORDER BY day ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
              ),2) AS rolling_7day_avg
       FROM daily_spend
       ORDER BY day`,
      [req.params.account_id]
    );
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Percentile rank vs historical months
router.get('/percentile/:account_id', auth, async (req, res) => {
  try {
    const r = await pool.query(
      `WITH monthly AS (
         SELECT DATE_TRUNC('month', created_at) AS month,
                SUM(amount) AS total
         FROM journal
         WHERE account_id=$1 AND direction='DEBIT'
         GROUP BY DATE_TRUNC('month', created_at)
       )
       SELECT month, total,
              ROUND(PERCENT_RANK() OVER (ORDER BY total)::NUMERIC * 100, 1) AS percentile_rank
       FROM monthly
       ORDER BY month DESC`,
      [req.params.account_id]
    );
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Regulatory audit — all changes in last 90 days
router.get('/audit-trail', auth, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT * FROM audit_log
       WHERE performed_by=$1
       AND created_at >= NOW() - INTERVAL '90 days'
       ORDER BY created_at DESC`,
      [req.user.customer_id]
    );
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Monthly summary from cache
router.get('/summary/:account_id', auth, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT * FROM monthly_summary_cache
       WHERE account_id=$1
       ORDER BY month DESC LIMIT 12`,
      [req.params.account_id]
    );
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;