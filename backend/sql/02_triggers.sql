-- AUTO CREATE BALANCE CACHE
CREATE OR REPLACE FUNCTION create_balance_cache()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO balance_cache (account_id, balance, version)
  VALUES (NEW.account_id, 0, 0);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_create_balance_cache
AFTER INSERT ON accounts
FOR EACH ROW EXECUTE FUNCTION create_balance_cache();

-- PREVENT INSUFFICIENT FUNDS
CREATE OR REPLACE FUNCTION check_balance_on_debit()
RETURNS TRIGGER AS $$
DECLARE
  current_bal NUMERIC;
BEGIN
  IF NEW.direction = 'DEBIT' THEN
    SELECT balance INTO current_bal
    FROM balance_cache WHERE account_id = NEW.account_id;
    IF current_bal < NEW.amount THEN
      RAISE EXCEPTION 'Insufficient funds. Balance: %, Required: %', current_bal, NEW.amount;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_check_balance
BEFORE INSERT ON journal
FOR EACH ROW EXECUTE FUNCTION check_balance_on_debit();

-- UPDATE BALANCE CACHE AFTER JOURNAL INSERT
CREATE OR REPLACE FUNCTION update_balance_cache()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.direction = 'CREDIT' THEN
    UPDATE balance_cache
    SET balance = balance + NEW.amount,
        version = version + 1,
        last_updated = NOW()
    WHERE account_id = NEW.account_id;
  ELSE
    UPDATE balance_cache
    SET balance = balance - NEW.amount,
        version = version + 1,
        last_updated = NOW()
    WHERE account_id = NEW.account_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_balance
AFTER INSERT ON journal
FOR EACH ROW EXECUTE FUNCTION update_balance_cache();

-- VAULT TIME-LOCK + GOAL-LOCK + PENALTY ENFORCEMENT
CREATE OR REPLACE FUNCTION enforce_vault_rules()
RETURNS TRIGGER AS $$
DECLARE
  acc RECORD;
  current_bal NUMERIC;
  penalty NUMERIC;
BEGIN
  SELECT * INTO acc FROM accounts WHERE account_id = NEW.account_id;

  IF acc.account_type = 'VAULT' AND NEW.direction = 'DEBIT' THEN
    SELECT balance INTO current_bal FROM balance_cache WHERE account_id = NEW.account_id;

    -- Time lock check
    IF acc.vault_unlock_date IS NOT NULL AND NOW() < acc.vault_unlock_date THEN
      IF acc.vault_penalty_pct > 0 THEN
        -- Allow but deduct penalty — penalty inserted as separate journal entry
        penalty := NEW.amount * (acc.vault_penalty_pct / 100);
        INSERT INTO notifications (
          customer_id, type, message
        )
        SELECT c.customer_id,
               'VAULT_PENALTY',
               'Early vault withdrawal penalty of ₹' || penalty || ' applied.'
        FROM accounts a JOIN customers c ON a.customer_id = c.customer_id
        WHERE a.account_id = NEW.account_id;
      ELSE
        RAISE EXCEPTION 'Vault is time-locked until %', acc.vault_unlock_date;
      END IF;
    END IF;

    -- Goal lock check
    IF acc.vault_target_amount IS NOT NULL AND current_bal < acc.vault_target_amount THEN
      RAISE EXCEPTION 'Vault goal of ₹% not yet reached. Current: ₹%',
        acc.vault_target_amount, current_bal;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_vault_rules
BEFORE INSERT ON journal
FOR EACH ROW EXECUTE FUNCTION enforce_vault_rules();

-- AUDIT LOG ON ACCOUNT CHANGES
CREATE OR REPLACE FUNCTION audit_account_changes()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_log (entity_type, entity_id, action, old_value, new_value)
  VALUES ('account', NEW.account_id, TG_OP,
          row_to_json(OLD)::jsonb, row_to_json(NEW)::jsonb);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_accounts
AFTER UPDATE ON accounts
FOR EACH ROW EXECUTE FUNCTION audit_account_changes();

-- AUDIT LOG ON CUSTOMER CHANGES
CREATE OR REPLACE FUNCTION audit_customer_changes()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_log (entity_type, entity_id, action, old_value, new_value)
  VALUES ('customer', NEW.customer_id, TG_OP,
          row_to_json(OLD)::jsonb, row_to_json(NEW)::jsonb);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_customers
AFTER UPDATE ON customers
FOR EACH ROW EXECUTE FUNCTION audit_customer_changes();

-- OUTBOX PATTERN ON NOTIFICATION INSERT
CREATE OR REPLACE FUNCTION notify_outbox()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO outbox (event_type, payload)
  VALUES (
    NEW.type,
    jsonb_build_object(
      'notification_id', NEW.notification_id,
      'customer_id', NEW.customer_id,
      'message', NEW.message,
      'type', NEW.type,
      'created_at', NEW.created_at
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_notification_outbox
AFTER INSERT ON notifications
FOR EACH ROW EXECUTE FUNCTION notify_outbox();

-- ROUND-UP SAVINGS TRIGGER
CREATE OR REPLACE FUNCTION apply_roundup()
RETURNS TRIGGER AS $$
DECLARE
  cat TEXT;
  rr RECORD;
  roundup_amt NUMERIC;
  ceil_val NUMERIC;
BEGIN
  IF NEW.direction = 'DEBIT' THEN
    SELECT category INTO cat FROM spending_categories
    WHERE transaction_id = NEW.transaction_id LIMIT 1;

    FOR rr IN
      SELECT * FROM roundup_rules
      WHERE source_account_id = NEW.account_id
      AND trigger_category = cat
      AND is_active = TRUE
    LOOP
      ceil_val := CEIL(NEW.amount / 100) * 100;
      roundup_amt := ceil_val - NEW.amount;
      IF roundup_amt > 0 THEN
        INSERT INTO transactions (type, status, initiated_by, amount, description)
        VALUES ('ROUNDUP_SAVE', 'PENDING', NULL, roundup_amt, 'Round-up auto-save')
        RETURNING transaction_id INTO NEW.transaction_id;

        INSERT INTO journal (transaction_id, account_id, amount, direction, entry_type, description)
        VALUES (NEW.transaction_id, NEW.account_id, roundup_amt, 'DEBIT', 'ROUNDUP', 'Round-up debit');

        INSERT INTO journal (transaction_id, account_id, amount, direction, entry_type, description)
        VALUES (NEW.transaction_id, rr.vault_account_id, roundup_amt, 'CREDIT', 'ROUNDUP', 'Round-up to vault');

        UPDATE transactions SET status = 'COMPLETED', completed_at = NOW()
        WHERE transaction_id = NEW.transaction_id;
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_roundup
AFTER INSERT ON journal
FOR EACH ROW EXECUTE FUNCTION apply_roundup();