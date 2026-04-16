const cron = require('node-cron');
const { processScheduled } = require('../services/schedulerService');

cron.schedule('* * * * *', async () => {
  try { await processScheduled(); }
  catch (err) { console.error('Scheduler job error:', err.message); }
});

console.log('Scheduled transaction executor started');