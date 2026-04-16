const pool = require('./src/config/db');
const { v4: uuidv4 } = require('uuid');

async function test() {
  try {
    const res = await pool.query(
      `INSERT INTO wal_log (transaction_id, operation, table_name, after_image)
       VALUES ($1, 'INSERT', 'journal', $2)`,
      [uuidv4(), JSON.stringify({ test: 1 })]
    );
    console.log("WAL INSERT SUCCESS");
  } catch (e) {
    console.error("WAL ERROR:", e.message);
  }

  try {
    const res = await pool.query(
      `SELECT 1 FROM balance_cache WHERE account_id=$1 FOR UPDATE`,
      [null]
    );
    console.log("SELECT 1 SUCCESS");
  } catch (e) {
    console.error("SELECT 1 ERROR:", e.message);
  }

  process.exit(0);
}
test();
