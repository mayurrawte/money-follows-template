import express, { type ErrorRequestHandler } from 'express';
import cors from 'cors';
import type { Db } from './db.js';
import { authRouter, requireAuth } from './auth.js';
import { groupsRouter } from './routes/groups.js';
import { expensesRouter } from './routes/expenses.js';
import { dashboardRouter } from './routes/dashboard.js';

export function createApp(db: Db) {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });
  app.use(authRouter(db));
  app.use(requireAuth(db), groupsRouter(db), expensesRouter(db), dashboardRouter(db));

  app.use((_req, res) => {
    res.status(404).json({ error: 'not found' });
  });
  const onError: ErrorRequestHandler = (err, _req, res, _next) => {
    const status = typeof err.status === 'number' ? err.status : 500;
    if (status === 500) console.error(err);
    res.status(status).json({ error: status === 500 ? 'internal server error' : err.message });
  };
  app.use(onError);

  return app;
}
