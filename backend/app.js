import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import { allowedOrigins } from './config/env.js';
import swaggerSpec from './config/swagger.js';
import { requestContext } from './middleware/request-context.js';
import { errorHandler, sanitizeLegacyErrorResponses } from './middleware/error-handler.js';
import publicRoutes from './routes/public.js';
import adminRoutes from './routes/admin.js';
import authRoutes from './routes/auth.js';
import customerAuthRoutes from './routes/customerAuth.js';
import paymentRoutes, { handlePayOSWebhook } from './routes/payments.js';
import postgresDb from './config/db-postgres.js';

export function createApp() {
  const app = express();

  // ─── Reverse Proxy Trust (Render standard: 1 hop) ───
  const rawTrustProxy = process.env.TRUST_PROXY;
  const trustProxySetting = rawTrustProxy === undefined || rawTrustProxy === ''
    ? 1
    : (/^\d+$/.test(rawTrustProxy) ? Number(rawTrustProxy) : rawTrustProxy);
  app.set('trust proxy', trustProxySetting);

  // ─── Security Middleware (OWASP) ───
  app.use(helmet());
  app.use(cors({ origin: allowedOrigins }));
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // ─── Request Context & Tracing ───
  app.use(requestContext);
  app.use(sanitizeLegacyErrorResponses);

  // ─── Kubernetes / Render Health Probes ───
  // /live: Liveness probe (checks process & event loop, zero DB access)
  app.get('/live', (req, res) => {
    res.status(200).json({ status: 'ok', uptime: Math.floor(process.uptime()) });
  });

  // /ready: Readiness probe (checks DB connectivity with 3s timeout)
  app.get('/ready', async (req, res) => {
    let timeoutId;
    try {
      const probePromise = postgresDb.query('SELECT 1');
      const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('DB readiness probe timed out after 3000ms')), 3000);
      });
      await Promise.race([probePromise, timeoutPromise]);
      res.status(200).json({ status: 'ready', database: 'connected' });
    } catch (err) {
      console.warn('⚠️ [Readiness Probe Failed]:', err.message);
      res.status(503).json({ status: 'unavailable', error: 'Database connection probe failed' });
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  });

  // ─────────────────────────────────────────────
  // 1) PayOS Webhook ONLY → /api/payments/payos/webhook
  // Bypass general rate limiter for third-party PayOS payment callbacks
  // ─────────────────────────────────────────────
  app.post('/api/payments/payos/webhook', handlePayOSWebhook);

  // ─────────────────────────────────────────────
  // 2) Rate Limiters
  // ─────────────────────────────────────────────
  const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    message: { error: 'Quá nhiều yêu cầu, vui lòng thử lại sau' },
  });

  const sensitiveLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Quá nhiều yêu cầu, vui lòng thử lại sau 15 phút' },
  });

  app.use('/api/orders', sensitiveLimiter);
  app.use('/api/vouchers/apply', sensitiveLimiter);
  app.use('/admin/login', sensitiveLimiter);
  app.use('/api/auth', sensitiveLimiter);

  // General limiter applies to all remaining /api routes (including /api/payments/payos/status)
  app.use('/api', generalLimiter);

  // ─────────────────────────────────────────────
  // 3) Payment Status & Lookup APIs
  // ─────────────────────────────────────────────
  app.use('/api/payments', paymentRoutes);

  // ─── API Documentation (Swagger) ───
  const swaggerHandler = swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'TeaPlus API Docs',
  });

  app.use('/api-docs', (req, res, next) => {
    const isEnabled = process.env.ENABLE_API_DOCS === 'true' || (process.env.NODE_ENV !== 'production' && process.env.ENABLE_API_DOCS !== 'false');
    if (!isEnabled) {
      return res.status(404).json({ error: 'API documentation is disabled in production' });
    }
    next();
  }, swaggerUi.serve, swaggerHandler);

  app.get('/api-docs.json', (req, res) => {
    const isEnabled = process.env.ENABLE_API_DOCS === 'true' || (process.env.NODE_ENV !== 'production' && process.env.ENABLE_API_DOCS !== 'false');
    if (!isEnabled) {
      return res.status(404).json({ error: 'API documentation is disabled in production' });
    }
    res.json(swaggerSpec);
  });

  // ─────────────────────────────────────────────
  // Customer Auth API    → /api/auth/*
  // Public API           → /api/*
  // Admin API            → /admin/*
  // ─────────────────────────────────────────────
  app.use('/api/auth', customerAuthRoutes);
  app.use('/api', publicRoutes);
  app.use('/admin', authRoutes);
  app.use('/admin', adminRoutes);

  // 404 fallback
  app.use((req, res) => {
    res.status(404).json({ error: `Route ${req.originalUrl} not found` });
  });

  // Central Error Handler
  app.use(errorHandler);

  return app;
}

export const app = createApp();
export default app;
