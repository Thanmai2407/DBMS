const pool = require('../config/db');

module.exports = async (req, res, next) => {
  const key = req.headers['idempotency-key'];
  if (!key) return next();
  try {
    const existing = await pool.query(
      'SELECT * FROM transactions WHERE idempotency_key = $1', [key]
    );
    if (existing.rows.length > 0) {
      return res.json({
        message: 'Duplicate request — returning original result',
        transaction: existing.rows[0],
        idempotent: true
      });
    }
    req.idempotencyKey = key;
    next();
  } catch (err) {
    next(err);
  }
};