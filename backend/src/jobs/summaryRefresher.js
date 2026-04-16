const cron = require('node-cron');
const pool = require('../config/db');

// Run at midnight every day
cron.schedule('0 0 * * *', async () => {
  try {
    const accounts = await pool.query('SELECT account_id FROM accounts');

    for (const acc of accounts.rows) {
      const r = await pool.query(
        `SELECT
           COALESCE(SUM(CASE WHEN direction='CREDIT' THEN amount ELSE 0 END),0) AS credits,
           COALESCE(SUM(CASE WHEN direction='DEBIT' THEN amount ELSE 0 END),0) AS debits,
           COUNT(*) AS cnt
         FROM journal
         WHERE account_id=$1
         AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', NOW())`,
        [acc.account_id]
      );

      const topCat = await pool.query(
        `SELECT sc.category, SUM(j.amount) AS total
         FROM journal j
         JOIN spending_categories sc ON j.transaction_id=sc.transaction_id
         WHERE j.account_id=$1 AND j.direction='DEBIT'
         AND DATE_TRUNC('month', j.created_at) = DATE_TRUNC('month', NOW())
         GROUP BY sc.category ORDER BY total DESC LIMIT 1`,
        [acc.account_id]
      );

      await pool.query(
        `INSERT INTO monthly_summary_cache
           (account_id, month, total_credits, total_debits, transaction_count, top_category)
         VALUES ($1, DATE_TRUNC('month', NOW()), $2, $3, $4, $5)
         ON CONFLICT (account_id, month)
         DO UPDATE SET
           total_credits=$2, total_debits=$3,
           transaction_count=$4, top_category=$5,
           last_refreshed=NOW()`,
        [
          acc.account_id,
          r.rows[0].credits,
          r.rows[0].debits,
          r.rows[0].cnt,
          topCat.rows[0]?.category || 'Other'
        ]
      );
    }
    console.log('Monthly summary cache refreshed');
  } catch (err) {
    console.error('Summary refresher error:', err.message);
  }
});

console.log('Summary refresher started');