const cron = require('node-cron');
const { runAllRules } = require('../services/fraudService');

cron.schedule('*/5 * * * *', async () => {
  try { await runAllRules(); }
  catch (err) { console.error('Fraud scanner error:', err.message); }
});

console.log('Fraud scanner started');