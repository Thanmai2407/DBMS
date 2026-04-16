-- ACCOUNT BALANCES
CREATE OR REPLACE VIEW account_balances AS
SELECT
  a.account_id, a.customer_id, a.account_type,
  a.status, a.vault_unlock_date, a.vault_target_amount,
  bc.balance, bc.version, bc.last_updated
FROM accounts a
JOIN balance_cache bc ON a.account_id = bc.account_id;

-- TRANSACTION HISTORY WITH RUNNING BALANCE
CREATE OR REPLACE VIEW transaction_history AS
SELECT
  j.entry_id, j.transaction_id, j.account_id,
  j.direction, j.amount, j.description, j.created_at,
  t.type, t.status, t.parent_transaction_id,
  SUM(CASE WHEN j.direction='CREDIT' THEN j.amount ELSE -j.amount END)
    OVER (PARTITION BY j.account_id ORDER BY j.created_at
          ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS running_balance
FROM journal j
JOIN transactions t ON j.transaction_id = t.transaction_id;

-- MONTHLY SPEND BY CATEGORY
CREATE OR REPLACE VIEW monthly_spend AS
SELECT
  j.account_id,
  sc.category,
  DATE_TRUNC('month', j.created_at) AS month,
  SUM(j.amount) AS total_spent,
  COUNT(*) AS transaction_count
FROM journal j
JOIN spending_categories sc ON j.transaction_id = sc.transaction_id
WHERE j.direction = 'DEBIT'
GROUP BY j.account_id, sc.category, DATE_TRUNC('month', j.created_at);

-- DOUBLE ENTRY INTEGRITY CHECK
CREATE OR REPLACE VIEW double_entry_check AS
SELECT
  transaction_id,
  SUM(CASE WHEN direction='CREDIT' THEN amount ELSE -amount END) AS net
FROM journal
GROUP BY transaction_id
HAVING SUM(CASE WHEN direction='CREDIT' THEN amount ELSE -amount END) != 0;

-- FRAUD SUMMARY PER ACCOUNT
CREATE OR REPLACE VIEW fraud_summary AS
SELECT
  account_id,
  COUNT(*) AS total_flags,
  SUM(CASE WHEN severity='HIGH' THEN 1 ELSE 0 END) AS high_severity,
  SUM(CASE WHEN status='OPEN' THEN 1 ELSE 0 END) AS open_flags,
  MAX(created_at) AS last_flagged
FROM fraud_flags
GROUP BY account_id;

-- LOAN SUMMARY
CREATE OR REPLACE VIEW loan_summary AS
SELECT
  l.loan_id, l.account_id, l.principal,
  l.interest_rate, l.tenure_months, l.emi_amount,
  l.outstanding_principal, l.status,
  l.total_interest_paid, l.total_principal_paid,
  COUNT(ls.id) FILTER (WHERE ls.status='PENDING') AS pending_emis,
  MIN(ls.due_date) FILTER (WHERE ls.status='PENDING') AS next_due_date
FROM loans l
LEFT JOIN loan_schedule ls ON l.loan_id = ls.loan_id
GROUP BY l.loan_id;