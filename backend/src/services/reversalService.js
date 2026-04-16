const pool = require('../config/db');
const { executeTransfer } = require('./transactionService');

async function requestReversal(transactionId, requestedBy, reason) {
  const db = await pool.connect();
  try {
    await db.query('BEGIN');

    const tx = await db.query(
      'SELECT * FROM transactions WHERE transaction_id=$1', [transactionId]
    );
    if (!tx.rows.length) throw new Error('Transaction not found');
    if (tx.rows[0].status !== 'COMPLETED') throw new Error('Only completed transactions can be reversed');
    if (tx.rows[0].type === 'REVERSAL') throw new Error('Cannot reverse a reversal');

    const existing = await db.query(
      `SELECT 1 FROM reversal_requests
       WHERE original_transaction_id=$1 AND status='PENDING'`,
      [transactionId]
    );
    if (existing.rows.length) throw new Error('Reversal already pending for this transaction');

    const req = await db.query(
      `INSERT INTO reversal_requests
         (original_transaction_id, requested_by, reason, status)
       VALUES ($1,$2,$3,'PENDING') RETURNING *`,
      [transactionId, requestedBy, reason]
    );

    // Notify receiver
    const credit = await db.query(
      `SELECT j.account_id, a.customer_id
       FROM journal j JOIN accounts a ON j.account_id=a.account_id
       WHERE j.transaction_id=$1 AND j.direction='CREDIT'`,
      [transactionId]
    );
    if (credit.rows.length) {
      await db.query(
        `INSERT INTO notifications (customer_id, type, message)
         VALUES ($1,'REVERSAL_REQUEST',
         'A payment credited to your account has been flagged for reversal. You have 48 hours to respond.')`,
        [credit.rows[0].customer_id]
      );
    }

    // Consent ledger
    await db.query(
      `INSERT INTO consent_ledger (customer_id, action_type, description)
       VALUES ($1,'REVERSAL_REQUESTED',$2)`,
      [requestedBy, `Reversal requested for tx ${transactionId}: ${reason}`]
    );

    await db.query('COMMIT');
    return req.rows[0];
  } catch (err) {
    await db.query('ROLLBACK');
    throw err;
  } finally {
    db.release();
  }
}

async function resolveReversal(requestId, resolution, resolvedBy) {
  const db = await pool.connect();
  try {
    await db.query('BEGIN');

    const reqRes = await db.query(
      'SELECT * FROM reversal_requests WHERE request_id=$1', [requestId]
    );
    if (!reqRes.rows.length) throw new Error('Reversal request not found');
    const rev = reqRes.rows[0];
    if (rev.status !== 'PENDING') throw new Error('Already resolved');
    if (new Date() > new Date(rev.expires_at)) throw new Error('Reversal window expired');

    if (resolution === 'APPROVED') {
      const entries = await db.query(
        'SELECT * FROM journal WHERE transaction_id=$1', [rev.original_transaction_id]
      );
      const debit = entries.rows.find(e => e.direction === 'DEBIT');
      const credit = entries.rows.find(e => e.direction === 'CREDIT');
      if (!debit || !credit) throw new Error('Original journal entries not found');

      await executeTransfer({
        fromAccountId: credit.account_id,
        toAccountId: debit.account_id,
        amount: parseFloat(debit.amount),
        description: `Reversal of transaction ${rev.original_transaction_id}`,
        type: 'REVERSAL',
        initiatedBy: resolvedBy,
        parentTransactionId: rev.original_transaction_id,
        client: db
      });
    }

    await db.query(
      `UPDATE reversal_requests
       SET status=$1, resolved_at=NOW()
       WHERE request_id=$2`,
      [resolution === 'APPROVED' ? 'APPROVED' : 'REJECTED', requestId]
    );

    // Notify requester
    await db.query(
      `INSERT INTO notifications (customer_id, type, message)
       SELECT a.customer_id,
              'REVERSAL_RESOLVED',
              $2
       FROM accounts a
       JOIN journal j ON a.account_id=j.account_id
       WHERE j.transaction_id=$1 AND j.direction='DEBIT'
       LIMIT 1`,
      [
        rev.original_transaction_id,
        resolution === 'APPROVED'
          ? '✅ Your reversal request was approved and funds have been returned.'
          : '❌ Your reversal request was rejected by the receiver.'
      ]
    );

    await db.query('COMMIT');
    return { status: resolution };
  } catch (err) {
    await db.query('ROLLBACK');
    throw err;
  } finally {
    db.release();
  }
}

module.exports = { requestReversal, resolveReversal };