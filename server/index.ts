// server/index.ts

import express, { Request, Response, NextFunction } from 'express';
import { setupVite, serveStatic, log } from './vite';

// ─────────────────────────────────────────────────────────────────────────────
// Dynamically load dotenv only in non-production (local dev):
if (process.env.NODE_ENV !== 'production') {
  const { default: dotenv } = await import('dotenv');
  dotenv.config();
  console.log(
    '🔧 Loaded local .env:',
    process.env.DATABASE_URL ? 'OK' : '❌ MISSING DATABASE_URL'
  );
}
// ─────────────────────────────────────────────────────────────────────────────


console.log("🚀 DATABASE_URL = ", process.env.DATABASE_URL);
const app = express();

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Simple API request logger
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let jsonBody: any;

  const origJson = res.json;
  res.json = (body, ...args) => {
    jsonBody = body;
    return origJson.call(res, body, ...args);
  };

  res.on('finish', () => {
    if (path.startsWith('/api')) {
      let line = `${req.method} ${path} ${res.statusCode} in ${Date.now() - start}ms`;
      if (jsonBody) line += ` :: ${JSON.stringify(jsonBody)}`;
      log(line.length > 80 ? line.slice(0, 79) + '…' : line);
    }
  });

  next();
});

(async () => {
  console.log('🚀 Starting app…');

  // Runtime check for DATABASE_URL (from Render or your local .env)
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL is not defined. Exiting.');
    process.exit(1);
  } else {
    console.log('✅ DATABASE_URL is defined');
  }

  // Dynamically import routes (and any DB-using modules) **after** env is ready
  const { registerRoutes } = await import('./routes');
  const server = await registerRoutes(app);

  // Global error handler
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    res.status(status).json({ message: err.message || 'Internal Server Error' });
    throw err;
  });

  // Vite dev vs. static prod
  if (app.get('env') === 'development') {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Listen on Render’s PORT (or 5000)
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({ port, host: '0.0.0.0', reusePort: true }, () => {
    log(`✅ Server running on http://localhost:${port}`);
  });
})();
