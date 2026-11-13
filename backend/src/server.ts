import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { rateLimit } from 'express-rate-limit';
import { pathToFileURL } from 'node:url';
import investigationRouter from './routes/investigation.js';
import knowledgeRouter from './routes/knowledge.js';
import { config } from './config.js';
import { closeSocket, initSocket } from './services/socket.js';

const app = express();
app.set('trust proxy', 1);
app.set('etag', 'strong');

// HTTP Response Compression for high-throughput bandwidth efficiency
app.use(compression({
  threshold: 1024,
  filter(req, res) {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
}));

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false,
}));

app.use(cors({
  origin(origin, callback) {
    if (!origin) {
      return callback(null, true);
    }

    const isProduction = process.env.NODE_ENV === 'production';
    const isConfiguredOrigin = origin === config.frontendOrigin
      && (!isProduction || config.frontendOrigin.startsWith('https://'));
    const isLocalDevelopmentOrigin = !isProduction
      && (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin));

    return callback(null, isConfiguredOrigin || isLocalDevelopmentOrigin);
  },
  credentials: true,
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '100kb' }));

// Global API rate limiting with standard headers
app.use('/api', rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: true,
  legacyHeaders: false,
}));

// Dedicated protection on investigation synthesis endpoint
app.use('/api/investigate', rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
}));

app.use('/api', investigationRouter);
app.use('/api', knowledgeRouter);

app.get('/', (_req: Request, res: Response) => {
  res.json({ name: 'MORPHOS API', status: 'online' });
});

app.use('/api/*', (_req: Request, res: Response) => {
  res.status(404).json({ error: 'Endpoint not found.' });
});

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err && typeof err === 'object' && 'type' in err && err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request payload exceeds size limit (100kb maximum).' });
  }
  console.error('Unhandled server error:', err);
  return res.status(500).json({ error: 'Internal server error.' });
});

const isMain = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;

if (isMain) {
  const server = app.listen(config.port, '0.0.0.0', () => {
    console.log(`MORPHOS backend listening on port ${config.port}`);
  });
  initSocket(server, config.frontendOrigin);

  // Optimize HTTP keep-alive timeouts for high-traffic reverse proxies (ALB, Nginx, Cloudflare)
  server.keepAliveTimeout = 65000;
  server.headersTimeout = 66000;

  // Graceful shutdown handling for container autoscaling
  const shutdown = (signal: string) => {
    console.log(`[SHUTDOWN] Received ${signal}. Draining active connections...`);
    void closeSocket();
    server.close(() => {
      console.log('[SHUTDOWN] HTTP server closed gracefully.');
      process.exit(0);
    });

    setTimeout(() => {
      console.error('[SHUTDOWN] Forcible shutdown after 10s timeout.');
      process.exit(1);
    }, 10000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

export default app;
