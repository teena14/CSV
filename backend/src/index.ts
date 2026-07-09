import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { connectDB } from './config/database';
import importRouter from './routes/import';

const app = express();
const PORT = process.env.PORT || 4000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

app.use(
  cors({
    origin: [FRONTEND_URL, 'http://localhost:3000', 'http://127.0.0.1:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'csv-importer-backend',
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/import', importRouter);

app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Unhandled Error]', err.message);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

async function bootstrap(): Promise<void> {
  await connectDB();

  const server = app.listen(PORT, () => {
    console.log(`\nCSV Importer Backend running on http://localhost:${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/api/health`);
    console.log(`CORS allowed for: ${FRONTEND_URL}\n`);
  });

  server.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is already in use. Another backend is probably already running.`);
      console.error(`Use the existing server at http://localhost:${PORT}, stop the other process, or set a different PORT in backend/.env.`);
      process.exit(1);
    }

    throw error;
  });
}

bootstrap().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
