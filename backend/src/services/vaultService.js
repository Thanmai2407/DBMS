const pool = require('../config/db');

async function createVault({ customerId, vaultType, unlockDate, targetAmount, penaltyPct, label }) {
  const result = await pool.query(
    `INSERT INTO accounts
       (customer_id, account_type, vault_unlock_date, vault_target_amount, vault_penalty_pct)
     VALUES ($1,'VAULT',$2,$3,$4) RETURNING *`,
    [customerId, unlockDate || null, targetAmount || null, penaltyPct || 0]
  );
  return result.rows[0];
}

async function getVaultStatus(accountId) {
  const result = await pool.query(
    `SELECT a.*, bc.balance
     FROM accounts a JOIN balance_cache bc ON a.account_id=bc.account_id
     WHERE a.account_id=$1 AND a.account_type='VAULT'`,
    [accountId]
  );
  if (!result.rows.length) throw new Error('Vault not found');
  const v = result.rows[0];

  const now = new Date();
  let locked = false;
  let lockReason = null;

  if (v.vault_unlock_date && now < new Date(v.vault_unlock_date)) {
    locked = true;
    lockReason = `Time-locked until ${new Date(v.vault_unlock_date).toLocaleDateString()}`;
  }
  if (v.vault_target_amount && parseFloat(v.balance) < parseFloat(v.vault_target_amount)) {
    locked = true;
    lockReason = `Goal not reached. Need ₹${v.vault_target_amount}, have ₹${v.balance}`;
  }

  return { ...v, locked, lockReason };
}

async function createRoundupRule(sourceAccountId, vaultAccountId, category) {
  const result = await pool.query(
    `INSERT INTO roundup_rules (source_account_id, vault_account_id, trigger_category)
     VALUES ($1,$2,$3) RETURNING *`,
    [sourceAccountId, vaultAccountId, category]
  );
  return result.rows[0];
}

async function createSplitRule(accountId, minTriggerAmount, legs) {
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    const rule = await db.query(
      `INSERT INTO split_rules (account_id, min_trigger_amount)
       VALUES ($1,$2) RETURNING *`,
      [accountId, minTriggerAmount]
    );
    for (const leg of legs) {
      await db.query(
        `INSERT INTO split_rule_legs (rule_id, destination_account_id, percentage, description)
         VALUES ($1,$2,$3,$4)`,
        [rule.rows[0].rule_id, leg.destination_account_id, leg.percentage, leg.description]
      );
    }
    await db.query('COMMIT');
    return rule.rows[0];
  } catch (err) {
    await db.query('ROLLBACK');
    throw err;
  } finally {
    db.release();
  }
}

module.exports = { createVault, getVaultStatus, createRoundupRule, createSplitRule };