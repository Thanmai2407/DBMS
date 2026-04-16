CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- CUSTOMERS
CREATE TABLE customers (
  customer_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  phone VARCHAR(15) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  kyc_status VARCHAR(20) DEFAULT 'PENDING',
  risk_score INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE
);

-- ACCOUNTS
CREATE TABLE accounts (
  account_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(customer_id),
  account_type VARCHAR(20) DEFAULT 'SAVINGS',
  currency VARCHAR(5) DEFAULT 'INR',
  status VARCHAR(20) DEFAULT 'ACTIVE',
  daily_limit NUMERIC(15,2) DEFAULT 100000,
  monthly_limit NUMERIC(15,2) DEFAULT 1000000,
  vault_unlock_date TIMESTAMPTZ,
  vault_target_amount NUMERIC(15,2),
  vault_penalty_pct NUMERIC(5,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- BALANCE CACHE
CREATE TABLE balance_cache (
  account_id UUID PRIMARY KEY REFERENCES accounts(account_id),
  balance NUMERIC(15,2) DEFAULT 0,
  version INTEGER DEFAULT 0,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT positive_balance CHECK (balance >= 0)
);

-- TRANSACTIONS
CREATE TABLE transactions (
  transaction_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  idempotency_key VARCHAR(100) UNIQUE,
  type VARCHAR(30) NOT NULL,
  status VARCHAR(20) DEFAULT 'PENDING',
  initiated_by UUID REFERENCES customers(customer_id),
  amount NUMERIC(15,2) NOT NULL,
  description TEXT,
  metadata JSONB DEFAULT '{}',
  failure_reason TEXT,
  parent_transaction_id UUID REFERENCES transactions(transaction_id),
  initiated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- JOURNAL — immutable double-entry ledger
CREATE TABLE journal (
  entry_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_id UUID REFERENCES transactions(transaction_id),
  account_id UUID REFERENCES accounts(account_id),
  amount NUMERIC(15,2) NOT NULL,
  direction VARCHAR(6) NOT NULL CHECK (direction IN ('DEBIT','CREDIT')),
  entry_type VARCHAR(30),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- REVERSAL REQUESTS
CREATE TABLE reversal_requests (
  request_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  original_transaction_id UUID REFERENCES transactions(transaction_id),
  requested_by UUID REFERENCES customers(customer_id),
  reason TEXT,
  status VARCHAR(20) DEFAULT 'PENDING',
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '48 hours',
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- SCHEDULED TRANSACTIONS
CREATE TABLE scheduled_transactions (
  schedule_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID REFERENCES accounts(account_id),
  recipient_account_id UUID REFERENCES accounts(account_id),
  schedule_type VARCHAR(30) DEFAULT 'FIXED_RECURRING',
  amount NUMERIC(15,2),
  frequency VARCHAR(20),
  condition_json JSONB DEFAULT '{}',
  next_execution TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  status VARCHAR(20) DEFAULT 'ACTIVE',
  label VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- SALARY LINKS
CREATE TABLE salary_links (
  link_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID REFERENCES accounts(account_id),
  employer_account_id UUID REFERENCES accounts(account_id),
  minimum_credit_amount NUMERIC(15,2) DEFAULT 10000,
  trigger_delay_hours INTEGER DEFAULT 48,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- SPLIT RULES
CREATE TABLE split_rules (
  rule_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID REFERENCES accounts(account_id),
  min_trigger_amount NUMERIC(15,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE split_rule_legs (
  leg_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rule_id UUID REFERENCES split_rules(rule_id),
  destination_account_id UUID REFERENCES accounts(account_id),
  percentage NUMERIC(5,2),
  description VARCHAR(100)
);

-- ROUND-UP SAVINGS RULES
CREATE TABLE roundup_rules (
  rule_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_account_id UUID REFERENCES accounts(account_id),
  vault_account_id UUID REFERENCES accounts(account_id),
  trigger_category VARCHAR(50) DEFAULT 'Food',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- BUDGETS
CREATE TABLE budgets (
  budget_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID REFERENCES accounts(account_id),
  category VARCHAR(50),
  monthly_limit NUMERIC(15,2),
  alert_threshold NUMERIC(5,2) DEFAULT 80.00,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(account_id, category)
);

-- SPENDING CATEGORIES
CREATE TABLE spending_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_id UUID REFERENCES transactions(transaction_id),
  category VARCHAR(50),
  confidence_score NUMERIC(4,2),
  classified_at TIMESTAMPTZ DEFAULT NOW()
);

-- LOANS
CREATE TABLE loans (
  loan_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID REFERENCES accounts(account_id),
  principal NUMERIC(15,2),
  interest_rate NUMERIC(5,2),
  tenure_months INTEGER,
  emi_amount NUMERIC(15,2),
  outstanding_principal NUMERIC(15,2),
  total_interest_paid NUMERIC(15,2) DEFAULT 0,
  total_principal_paid NUMERIC(15,2) DEFAULT 0,
  disbursed_at TIMESTAMPTZ DEFAULT NOW(),
  status VARCHAR(20) DEFAULT 'ACTIVE'
);

-- LOAN SCHEDULE
CREATE TABLE loan_schedule (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  loan_id UUID REFERENCES loans(loan_id),
  emi_number INTEGER,
  due_date TIMESTAMPTZ,
  principal_component NUMERIC(15,2),
  interest_component NUMERIC(15,2),
  emi_amount NUMERIC(15,2),
  remaining_principal NUMERIC(15,2),
  status VARCHAR(20) DEFAULT 'PENDING',
  paid_at TIMESTAMPTZ
);

-- FRAUD FLAGS
CREATE TABLE fraud_flags (
  flag_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_id UUID REFERENCES transactions(transaction_id),
  account_id UUID REFERENCES accounts(account_id),
  rule_triggered VARCHAR(100),
  severity VARCHAR(20),
  status VARCHAR(20) DEFAULT 'OPEN',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- TRANSACTION IP LOG
CREATE TABLE transaction_ip_log (
  log_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_id UUID REFERENCES transactions(transaction_id),
  account_id UUID REFERENCES accounts(account_id),
  ip_address VARCHAR(45),
  city VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- AUDIT LOG
CREATE TABLE audit_log (
  log_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_type VARCHAR(50),
  entity_id UUID,
  action VARCHAR(50),
  performed_by UUID,
  old_value JSONB,
  new_value JSONB,
  ip_address VARCHAR(45),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- WAL LOG
CREATE TABLE wal_log (
  lsn BIGSERIAL PRIMARY KEY,
  transaction_id UUID,
  operation VARCHAR(10),
  table_name VARCHAR(50),
  before_image JSONB,
  after_image JSONB,
  committed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- NOTIFICATIONS
CREATE TABLE notifications (
  notification_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(customer_id),
  type VARCHAR(50),
  message TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- OUTBOX — reliable event delivery (Phase 9)
CREATE TABLE outbox (
  outbox_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type VARCHAR(50),
  payload JSONB,
  processed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

-- CONSENT LEDGER
CREATE TABLE consent_ledger (
  consent_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(customer_id),
  action_type VARCHAR(100),
  description TEXT,
  ip_address VARCHAR(45),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- MONTHLY SUMMARY CACHE (Phase 10 materialized)
CREATE TABLE monthly_summary_cache (
  cache_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID REFERENCES accounts(account_id),
  month DATE,
  total_credits NUMERIC(15,2) DEFAULT 0,
  total_debits NUMERIC(15,2) DEFAULT 0,
  transaction_count INTEGER DEFAULT 0,
  top_category VARCHAR(50),
  last_refreshed TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(account_id, month)
);