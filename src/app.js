import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config/index.js';
import authRouter from './routes/auth.js';
import logger from './middleware/logger.js';
import errorHandler from './middleware/errorHandler.js';
import accountsRouter from './routes/accounts.js';
import transactionsRouter from './routes/transactions.js';

const app = express();

app.use(express.json());
app.use(cors({ origin: config.cors.origin }));
app.use(helmet());
app.use(logger);

// Health check
app.get('/', (req, res) => {
  res.send('Hello World!');
});

// Routes
app.use('/auth', authRouter);
app.use('/accounts', accountsRouter);
app.use('/transactions', transactionsRouter);

// 404 handler (must be after all routes)
app.use((req, res) => {
  res.status(404).json({ status: false, error: 'Not Found' });
});

// Centralized error handler
app.use(errorHandler);

const PORT = config.port;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

export default app;
