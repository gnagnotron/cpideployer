import express from 'express';
import cors from 'cors';
import apiRouter from './routes/api';
import appV1Router from './routes/app-v1';
import { env } from './config/env';

const app = express();
const PORT = env.port;

app.use(
  cors({
    origin: env.corsOrigin === '*' ? true : env.corsOrigin,
  })
);
app.use(express.json({ limit: '2mb' }));

app.use('/api', apiRouter);
app.use('/api/v1', appV1Router);

app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`CPI Mapping Copilot backend running on http://localhost:${PORT}`);
  });
}

export default app;
