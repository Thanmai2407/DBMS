const pool = require('../config/db');

async function runAllRules() {
  await velocityCheck();
  await roundAmountPattern();
  await dormantActivation();
  await stddevAnomalyCheck();
}

async function flagFraud(accountId, transactionId, rule, severity) {
  await pool.query(
    `INSERT INTO fraud_flags (transaction_id, account_id, rule_triggered, severity)
     VALUES ($1,$2,$3,$4)`,
    [transactionId, accountId, rule, severity]
  );
  const cust = await pool.query(
    'SELECT customer_id FROM accounts WHERE account_id=$1', [accountId]
  );
  if (cust.rows.length) {
    await pool.query(
      `INSERT INTO notifications (customer_id, type, message)
       VALUES ($1,'FRAUD_ALERT',$2)`,
      [cust.rows[0].customer_id, `🚨 Suspicious activity: ${rule} detected on your account`]
    );
  }
}

async function velocityCheck() {
  const res = await pool.query(
    `SELECT account_id, COUNT(*) AS cnt
     FROM journal
     WHERE direction='DEBIT' AND created_at >= NOW() - INTERVAL '10 minutes'
     GROUP BY account_id HAVING COUNT(*) > 5`
  );
  for (const row of res.rows) {
    await flagFraud(row.account_id, null, 'VELOCITY_BREACH', 'HIGH');
  }
}

async function roundAmountPattern() {
  const res = await pool.query(
    `SELECT j.account_id, j.transaction_id
     FROM journal j
     WHERE j.direction='DEBIT'
     AND j.amount IN (1,10,100,500,1000)
     AND j.created_at >= NOW() - INTERVAL '30 minutes'
     AND NOT EXISTS (
       SELECT 1 FROM fraud_flags ff WHERE ff.transaction_id=j.transaction_id
     )`
  );
  for (const row of res.rows) {
    await flagFraud(row.account_id, row.transaction_id, 'ROUND_AMOUNT_PATTERN', 'MEDIUM');
  }
}

async function dormantActivation() {
  const res = await pool.query(
    `SELECT DISTINCT j.account_id, j.transaction_id
     FROM journal j
     WHERE j.direction='DEBIT' AND j.amount > 10000
     AND j.created_at >= NOW() - INTERVAL '1 hour'
     AND (
       SELECT MAX(j2.created_at) FROM journal j2
       WHERE j2.account_id=j.account_id AND j2.created_at < j.created_at
     ) < NOW() - INTERVAL '90 days'`
  );
  for (const row of res.rows) {
    await flagFraud(row.account_id, row.transaction_id, 'DORMANT_ACTIVATION', 'HIGH');
  }
}

async function stddevAnomalyCheck() {
  const res = await pool.query(
    `WITH stats AS (
       SELECT account_id,
              AVG(amount) AS avg_amt,
              STDDEV(amount) AS std_amt
       FROM journal
       WHERE direction='DEBIT'
       AND created_at >= NOW() - INTERVAL '90 days'
       GROUP BY account_id
     )
     SELECT j.account_id, j.transaction_id, j.amount,
            s.avg_amt, s.std_amt
     FROM journal j
     JOIN stats s ON j.account_id=s.account_id
     WHERE j.direction='DEBIT'
     AND j.created_at >= NOW() - INTERVAL '1 hour'
     AND s.std_amt > 0
     AND j.amount > s.avg_amt + (3 * s.std_amt)
     AND NOT EXISTS (
       SELECT 1 FROM fraud_flags ff WHERE ff.transaction_id=j.transaction_id
     )`
  );
  for (const row of res.rows) {
    await flagFraud(row.account_id, row.transaction_id, 'STDDEV_ANOMALY', 'HIGH');
  }
}

module.exports = { runAllRules, flagFraud };