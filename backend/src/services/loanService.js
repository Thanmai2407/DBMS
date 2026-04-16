const pool = require('../config/db');

function calculateEMI(principal, annualRate, months) {
  const r = annualRate / 12 / 100;
  if (r === 0) return principal / months;
  return (principal * r * Math.pow(1+r, months)) / (Math.pow(1+r, months) - 1);
}

function buildSchedule(principal, annualRate, months, emi) {
  const schedule = [];
  let remaining = principal;
  const r = annualRate / 12 / 100;
  const now = new Date();

  for (let i = 1; i <= months; i++) {
    const interest = parseFloat((remaining * r).toFixed(2));
    const principalComp = parseFloat((emi - interest).toFixed(2));
    remaining = Math.max(0, parseFloat((remaining - principalComp).toFixed(2)));
    const due = new Date(now);
    due.setMonth(due.getMonth() + i);
    schedule.push({
      emi_number: i,
      due_date: due,
      principal_component: principalComp,
      interest_component: interest,
      emi_amount: parseFloat(emi.toFixed(2)),
      remaining_principal: remaining
    });
  }
  return schedule;
}

async function disburseLoan({ accountId, principal, annualRate, tenureMonths, initiatedBy }) {
  const db = await pool.connect();
  try {
    await db.query('BEGIN');

    const emi = calculateEMI(principal, annualRate, tenureMonths);
    const loan = await db.query(
      `INSERT INTO loans
         (account_id,principal,interest_rate,tenure_months,emi_amount,outstanding_principal)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [accountId, principal, annualRate, tenureMonths, emi.toFixed(2), principal]
    );

    const schedule = buildSchedule(principal, annualRate, tenureMonths, emi);
    for (const s of schedule) {
      await db.query(
        `INSERT INTO loan_schedule
           (loan_id,emi_number,due_date,principal_component,interest_component,emi_amount,remaining_principal)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [loan.rows[0].loan_id, s.emi_number, s.due_date,
         s.principal_component, s.interest_component, s.emi_amount, s.remaining_principal]
      );
    }

    // Disburse funds directly
    const tx = await db.query(
      `INSERT INTO transactions (type,status,initiated_by,amount,description)
       VALUES ('LOAN_DISBURSAL','PENDING',$1,$2,'Loan disbursement') RETURNING *`,
      [initiatedBy, principal]
    );
    await db.query(
      `INSERT INTO journal (transaction_id,account_id,amount,direction,entry_type,description)
       VALUES ($1,$2,$3,'CREDIT','LOAN_DISBURSAL','Loan disbursement')`,
      [tx.rows[0].transaction_id, accountId, principal]
    );
    await db.query(
      `UPDATE transactions SET status='COMPLETED', completed_at=NOW()
       WHERE transaction_id=$1`,
      [tx.rows[0].transaction_id]
    );

    await db.query('COMMIT');
    return { loan: loan.rows[0], schedule };
  } catch (err) {
    await db.query('ROLLBACK');
    throw err;
  } finally {
    db.release();
  }
}

async function payEMI(loanId, accountId, initiatedBy) {
  const db = await pool.connect();
  try {
    await db.query('BEGIN');

    const loan = await db.query(
      'SELECT * FROM loans WHERE loan_id=$1 AND status=$2',
      [loanId, 'ACTIVE']
    );
    if (!loan.rows.length) throw new Error('Loan not found or not active');

    const nextEMI = await db.query(
      `SELECT * FROM loan_schedule
       WHERE loan_id=$1 AND status='PENDING'
       ORDER BY emi_number ASC LIMIT 1`,
      [loanId]
    );
    if (!nextEMI.rows.length) throw new Error('No pending EMIs');

    const emi = nextEMI.rows[0];

    const tx = await db.query(
      `INSERT INTO transactions (type,status,initiated_by,amount,description)
       VALUES ('LOAN_EMI','PENDING',$1,$2,$3) RETURNING *`,
      [initiatedBy, emi.emi_amount, `EMI #${emi.emi_number} for loan ${loanId}`]
    );

    await db.query(
      `INSERT INTO journal (transaction_id,account_id,amount,direction,entry_type,description)
       VALUES ($1,$2,$3,'DEBIT','LOAN_EMI','EMI payment')`,
      [tx.rows[0].transaction_id, accountId, emi.emi_amount]
    );

    await db.query(
      `UPDATE loan_schedule SET status='PAID', paid_at=NOW() WHERE id=$1`,
      [emi.id]
    );

    await db.query(
      `UPDATE loans
       SET outstanding_principal = outstanding_principal - $1,
           total_principal_paid = total_principal_paid + $2,
           total_interest_paid = total_interest_paid + $3
       WHERE loan_id = $4`,
      [emi.principal_component, emi.principal_component, emi.interest_component, loanId]
    );

    await db.query(
      `UPDATE transactions SET status='COMPLETED', completed_at=NOW()
       WHERE transaction_id=$1`,
      [tx.rows[0].transaction_id]
    );

    await db.query('COMMIT');
    return { paid: emi };
  } catch (err) {
    await db.query('ROLLBACK');
    throw err;
  } finally {
    db.release();
  }
}

module.exports = { disburseLoan, payEMI, calculateEMI, buildSchedule };