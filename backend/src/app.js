const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());

app.use('/api/auth',         require('./routes/auth'));
app.use('/api/accounts',     require('./routes/accounts'));
app.use('/api/transactions', require('./routes/transactions'));
app.use('/api/reversals',    require('./routes/reversals'));
app.use('/api/loans',        require('./routes/loans'));
app.use('/api/scheduled',    require('./routes/scheduled'));
app.use('/api/vaults',       require('./routes/vaults'));
app.use('/api/fraud',        require('./routes/fraud'));
app.use('/api/analytics',    require('./routes/analytics'));

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: err.message });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server on port ${PORT}`));

require('./jobs/scheduledTxExecutor');
require('./jobs/fraudScanner');
require('./jobs/outboxProcessor');
require('./jobs/summaryRefresher');