const pool = require('../config/db');
const { executeTransfer } = require('./transactionService');

async function processScheduled() {
  const due = await pool.query(
    `SELECT * FROM scheduled_transactions
     WHERE status='ACTIVE' AND next_execution <= NOW()`
  );

  for (const s of due.rows) {
    try {
      await executeTransfer({
        fromAccountId: s.account_id,
        toAccountId: s.recipient_account_id,
        amount: parseFloat(s.amount),
        description: s.label || `Scheduled: ${s.schedule_type}`,
        type: 'SCHEDULED',
        initiatedBy: null
      });

      const next = computeNext(s.frequency, new Date(s.next_execution));
      if (next && (!s.end_date || next <= new Date(s.end_date))) {
        await pool.query(
          'UPDATE scheduled_transactions SET next_execution=$1 WHERE schedule_id=$2',
          [next, s.schedule_id]
        );
      } else {
        await pool.query(
          `UPDATE scheduled_transactions SET status='COMPLETED' WHERE schedule_id=$1`,
          [s.schedule_id]
        );
      }

      // Notify
      const cust = await pool.query(
        'SELECT customer_id FROM accounts WHERE account_id=$1', [s.account_id]
      );
      if (cust.rows.length) {
        await pool.query(
          `INSERT INTO notifications (customer_id, type, message)
           VALUES ($1,'SCHEDULED_TX_EXECUTED',$2)`,
          [cust.rows[0].customer_id,
           `✅ Scheduled payment of ₹${s.amount} (${s.label || s.schedule_type}) executed`]
        );
      }
    } catch (err) {
      console.error(`Scheduled tx failed for ${s.schedule_id}:`, err.message);
      await pool.query(
        `INSERT INTO notifications (customer_id, type, message)
         SELECT customer_id,'SCHEDULED_TX_FAILED',$2
         FROM accounts WHERE account_id=$1`,
        [s.account_id, `❌ Scheduled payment of ₹${s.amount} failed: ${err.message}`]
      );
    }
  }
}

function computeNext(frequency, from) {
  const d = new Date(from);
  if (frequency === 'DAILY') { d.setDate(d.getDate() + 1); return d; }
  if (frequency === 'WEEKLY') { d.setDate(d.getDate() + 7); return d; }
  if (frequency === 'MONTHLY') { d.setMonth(d.getMonth() + 1); return d; }
  return null;
}

module.exports = { processScheduled };