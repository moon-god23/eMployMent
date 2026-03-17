import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cron from 'node-cron';

import studentsRouter     from './routes/students.js';
import listingsRouter     from './routes/listings.js';
import matchRouter        from './routes/match.js';
import applicationsRouter from './routes/applications.js';
import ingestRouter       from './routes/ingest.js';
import scrapeRouter       from './routes/scrape.js';

const app  = express();
const PORT = process.env.PORT || 5000;

// CORS — allow both local dev and Vercel production frontend
const allowedOrigins = [
  'http://localhost:5173',
  process.env.FRONTEND_URL,           // set to https://n8tern.vercel.app in Render env
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, or server-to-server)
    if (!origin) return callback(null, true);
    
    // Normalize both by removing trailing slashes for comparison
    const normalizedOrigin = origin.replace(/\/$/, '');
    const isAllowed = allowedOrigins.some(allowed => 
      allowed.replace(/\/$/, '') === normalizedOrigin
    );

    if (isAllowed) return callback(null, true);
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));

app.use(express.json());

// Register all API routes
app.use('/api/students',       studentsRouter);
app.use('/api/listings',       listingsRouter);
app.use('/api/match',          matchRouter);
app.use('/api/applications',   applicationsRouter);
app.use('/api/ingest-listing', ingestRouter);
app.use('/api/scrape',         scrapeRouter);

// Health check — Render pings this to confirm service is up
app.get('/health', (_, res) => res.json({ status: 'ok', env: process.env.NODE_ENV }));

// Backup cron — fires every 6 hours even if n8n Cloud workflow is paused
// In production on Render this cron runs on the Render instance
cron.schedule('0 */6 * * *', () => {
  const baseURL = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
  console.log('[CRON] Scheduled scrape starting...');
  fetch(`${baseURL}/api/scrape`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ strategy: 'auto' }),
  }).catch(err => console.error('[CRON] Failed:', err.message));
});

app.listen(PORT, () => console.log(`🚀 n8tern backend → http://localhost:${PORT}`));
