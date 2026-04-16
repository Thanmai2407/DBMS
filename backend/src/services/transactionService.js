const pool = require('../config/db');
const { v4: uuidv4 } = require('uuid');

function classifyCategory(description = '') {
  const d = description.toLowerCase();
  if (/zomato|swiggy|food|restaurant|cafe|pizza|burger/.test(d)) return 'Food';
  if (/irctc|redbus|uber|ola|travel|flight|hotel|makemytrip/.test(d)) return 'Travel';
  if (/netflix|spotify|prime|hotstar|entertainment|movie|pvr/.test(d)) return 'Entertainment';
  if (/amazon|flipkart|shopping|mall|myntra|ajio/.test(d)) return 'Shopping';
  if (/salary|payroll|ctc/.test(d)) return 'Income';
  if (/emi|loan|repay/.test(d)) return 'Loan';
  if (/electricity|water|gas|bill|bsnl|airtel|jio/.test(d)) return 'Utilities';
  if (/gym|health|pharmacy|doctor|hospital|medic/.test(d)) return 'Health';
  return 'Other';
}

async function executeTransfer({
  fromAccountId,
  toAccountId,
  amount,
  description,
  type = 'TRANSFER',
  idempotencyKey,
  initiatedBy,
  parentTransactionId = null,
  client = null
}) {
  const db = client || await pool.connect();
  const isExternal = !!client;

  try {
    if (!isExternal) await db.query('BEGIN');

    // WAL write-intent
    await db.query(
      `INSERT INTO wal_log (transaction_id, operation, table_name, after_image)
       VALUES ($1, 'INSERT', 'journal', $2)`,
      [uuidv4(), JSON.stringify({ fromAccountId, toAccountId, amount, type })]
    );

    // Create transaction record
    const txRes = await db.query(
      `INSERT INTO transactions
         (idempotency_key, type, status, initiated_by, amount, description, parent_transaction_id)
       VALUES ($1,$2,'PENDING',$3,$4,$5,$6) RETURNING *`,
      [idempotencyKey || uuidv4(), type, initiatedBy, amount, description, parentTransactionId]
    );
    const tx = txRes.rows[0];

    // Lock both rows in deterministic order to prevent deadlock
    const [first, second] = [fromAccountId, toAccountId].sort();
    await db.query('SELECT 1 FROM balance_cache WHERE account_id=$1 FOR UPDATE', [first]);
    await db.query('SELECT 1 FROM balance_cache WHERE account_id=$1 FOR UPDATE', [second]);

    // Verify balance
    const balRes = await db.query(
      'SELECT balance FROM balance_cache WHERE account_id=$1', [fromAccountId]
    );
    if (!balRes.rows.length || parseFloat(balRes.rows[0].balance) < amount) {
      throw new Error(`Insufficient funds. Available: ₹${balRes.rows[0]?.balance || 0}`);
    }

    // Verify recipient exists
    const toAccRes = await db.query(
      'SELECT 1 FROM balance_cache WHERE account_id=$1', [toAccountId]
    );
    if (!toAccRes.rows.length) {
      throw new Error('Recipient account not found');
    }

    // Debit
    await db.query(
      `INSERT INTO journal (transaction_id,account_id,amount,direction,entry_type,description)
       VALUES ($1,$2,$3,'DEBIT',$4,$5)`,
      [tx.transaction_id, fromAccountId, amount, type, description]
    );

    // Credit
    await db.query(
      `INSERT INTO journal (transaction_id,account_id,amount,direction,entry_type,description)
       VALUES ($1,$2,$3,'CREDIT',$4,$5)`,
      [tx.transaction_id, toAccountId, amount, type, description]
    );

    // Complete transaction
    await db.query(
      `UPDATE transactions SET status='COMPLETED', completed_at=NOW()
       WHERE transaction_id=$1`,
      [tx.transaction_id]
    );

    // WAL commit
    await db.query(
      `UPDATE wal_log SET committed=TRUE
       WHERE transaction_id=$1 AND committed=FALSE`,
      [tx.transaction_id]
    );

    // Classify category
    const category = classifyCategory(description);
    await db.query(
      `INSERT INTO spending_categories (transaction_id, category, confidence_score)
       VALUES ($1,$2,0.85)`,
      [tx.transaction_id, category]
    );

    // Budget check
    await checkBudgetAlert(db, fromAccountId, category, amount);

    // Check split rules
    await applySplitRules(db, toAccountId, amount, tx.transaction_id);

    if (!isExternal) await db.query('COMMIT');
    return tx;

  } catch (err) {
    if (!isExternal) await db.query('ROLLBACK');
    throw err;
  } finally {
    if (!isExternal) db.release();
  }
}

async function checkBudgetAlert(db, accountId, category, amount) {
  try {
    const budget = await db.query(
      'SELECT * FROM budgets WHERE account_id=$1 AND category=$2',
      [accountId, category]
    );
    if (!budget.rows.length) return;

    const spent = await db.query(
      `SELECT COALESCE(SUM(j.amount),0) AS total
       FROM journal j
       JOIN spending_categories sc ON j.transaction_id = sc.transaction_id
       WHERE j.account_id=$1 AND sc.category=$2
       AND j.direction='DEBIT'
       AND DATE_TRUNC('month', j.created_at) = DATE_TRUNC('month', NOW())`,
      [accountId, category]
    );

    const total = parseFloat(spent.rows[0].total);
    const limit = parseFloat(budget.rows[0].monthly_limit);
    const pct = (total / limit) * 100;

    const custRes = await db.query(
      'SELECT customer_id FROM accounts WHERE account_id=$1', [accountId]
    );
    if (!custRes.rows.length) return;
    const custId = custRes.rows[0].customer_id;

    let msg = null;
    if (pct >= 110)
      msg = `🚨 You exceeded your ${category} budget by ${(pct - 100).toFixed(0)}%`;
    else if (pct >= 100)
      msg = `🔴 You hit your ${category} budget limit of ₹${limit}`;
    else if (pct >= parseFloat(budget.rows[0].alert_threshold))
      msg = `🟡 You've used ${pct.toFixed(0)}% of your ₹${limit} ${category} budget`;

    if (msg) {
      await db.query(
        `INSERT INTO notifications (customer_id, type, message)
         VALUES ($1,'BUDGET_ALERT',$2)`,
        [custId, msg]
      );
    }
  } catch (e) {
    console.error('Budget check error:', e.message);
  }
}

async function applySplitRules(db, accountId, creditAmount, txId) {
  try {
    const rules = await db.query(
      `SELECT sr.*, srl.destination_account_id, srl.percentage, srl.description as leg_desc
       FROM split_rules sr
       JOIN split_rule_legs srl ON sr.rule_id = srl.rule_id
       WHERE sr.account_id=$1 AND sr.is_active=TRUE AND $2 >= sr.min_trigger_amount`,
      [accountId, creditAmount]
    );
    if (!rules.rows.length) return;

    // Group by rule
    const ruleMap = {};
    for (const row of rules.rows) {
      if (!ruleMap[row.rule_id]) ruleMap[row.rule_id] = [];
      ruleMap[row.rule_id].push(row);
    }

    for (const [ruleId, legs] of Object.entries(ruleMap)) {
      for (const leg of legs) {
        const splitAmt = parseFloat(((leg.percentage / 100) * creditAmount).toFixed(2));
        if (splitAmt <= 0) continue;

        const splitTx = await db.query(
          `INSERT INTO transactions (type, status, initiated_by, amount, description, parent_transaction_id)
           VALUES ('AUTO_SPLIT','PENDING',NULL,$1,$2,$3) RETURNING *`,
          [splitAmt, leg.leg_desc || 'Auto split', txId]
        );

        await db.query(
          `INSERT INTO journal (transaction_id,account_id,amount,direction,entry_type,description)
           VALUES ($1,$2,$3,'DEBIT','AUTO_SPLIT',$4)`,
          [splitTx.rows[0].transaction_id, accountId, splitAmt, leg.leg_desc]
        );

        await db.query(
          `INSERT INTO journal (transaction_id,account_id,amount,direction,entry_type,description)
           VALUES ($1,$2,$3,'CREDIT','AUTO_SPLIT',$4)`,
          [splitTx.rows[0].transaction_id, leg.destination_account_id, splitAmt, leg.leg_desc]
        );

        await db.query(
          `UPDATE transactions SET status='COMPLETED', completed_at=NOW()
           WHERE transaction_id=$1`,
          [splitTx.rows[0].transaction_id]
        );
      }
    }
  } catch (e) {
    console.error('Split rule error:', e.message);
  }
}

async function deposit(accountId, amount, description, initiatedBy) {
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    const tx = await db.query(
      `INSERT INTO transactions (type,status,initiated_by,amount,description)
       VALUES ('DEPOSIT','PENDING',$1,$2,$3) RETURNING *`,
      [initiatedBy, amount, description]
    );
    await db.query(
      `INSERT INTO journal (transaction_id,account_id,amount,direction,entry_type,description)
       VALUES ($1,$2,$3,'CREDIT','DEPOSIT',$4)`,
      [tx.rows[0].transaction_id, accountId, amount, description]
    );
    await db.query(
      `UPDATE transactions SET status='COMPLETED', completed_at=NOW()
       WHERE transaction_id=$1`,
      [tx.rows[0].transaction_id]
    );
    await db.query('COMMIT');
    return tx.rows[0];
  } catch (err) {
    await db.query('ROLLBACK');
    throw err;
  } finally {
    db.release();
  }
}

module.exports = { executeTransfer, deposit, classifyCategory };