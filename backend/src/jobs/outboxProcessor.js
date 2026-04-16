const cron = require('node-cron');
const pool = require('../config/db');

cron.schedule('*/30 * * * * *', async () => {
  try {
    const events = await pool.query(
      `SELECT * FROM outbox WHERE processed=FALSE
       ORDER BY created_at ASC LIMIT 50`
    );

    for (const evt of events.rows) {
      try {
        // In real system: send to email/SMS/push service here
        console.log(`[OUTBOX] Processing event: ${evt.event_type}`, evt.payload?.message || '');

        await pool.query(
          `UPDATE outbox SET processed=TRUE, processed_at=NOW()
           WHERE outbox_id=$1`,
          [evt.outbox_id]
        );
      } catch (err) {
        console.error(`Failed to process outbox event ${evt.outbox_id}:`, err.message);
      }
    }
  } catch (err) {
    console.error('Outbox processor error:', err.message);
  }
});

console.log('Outbox processor started');