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
  // Disable automatic ETag freshness handling for dynamic polling responses.
  // Otherwise Express can turn KDS requests into 304 responses with no JSON body.
  app.set('etag', false);

  // ─── Reverse Proxy Trust (Render standard: 1 hop) ───
  const rawTrustProxy = process.env.TRUST_PROXY;
  const normalizedTrustProxy = rawTrustProxy?.trim().toLowerCase();
  const trustProxySetting = normalizedTrustProxy === undefined || normalizedTrustProxy === ''
    ? 1
    : normalizedTrustProxy === 'true'
      ? true
      : normalizedTrustProxy === 'false'
        ? false
        : (/^\d+$/.test(normalizedTrustProxy) ? Number(normalizedTrustProxy) : rawTrustProxy.trim());
  app.set('trust proxy', trustProxySetting);

  // ─── Security Middleware (OWASP) ───
  app.use(helmet());
  app.use(cors({ origin: allowedOrigins }));
  // Product images are sent as base64 data URLs (frontend limit: 2MB).
  // Keep a small envelope for JSON metadata without allowing oversized
  // request bodies across every endpoint.
  app.use(express.json({ limit: '4mb' }));
  app.use(express.urlencoded({ extended: true, limit: '4mb' }));

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
  // 2) Rate Limiters (Phân Tầng Rành Mạch)
  // ─────────────────────────────────────────────
  // 2a. Polling Limiter: Tra cứu trạng thái đơn hàng (GET /api/orders/lookup, /track, /payments/payos/status)
  // Ngân sách 1200 request / 15 phút (cho phép poll liên tục mỗi 3s trong suốt 60 phút)
  const pollingLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1200,
    standardHeaders: true,
    legacyHeaders: false,
    validate: { keyGeneratorIpFallback: false },
    keyGenerator: (req) => {
      const code = String(req.query.code || '').trim().toUpperCase();
      const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown-ip';
      return `${ip}:${code}`;
    },
    message: { error: 'Quá nhiều yêu cầu tra cứu đơn hàng, vui lòng đợi trong giây lát' },
  });

  // 2b. Order Mutation Limiter: Tạo đơn, hủy đơn, áp mã ưu đãi (POST)
  const orderMutationLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Quá nhiều thao tác đơn hàng, vui lòng thử lại sau 15 phút' },
  });

  // 2c. Auth Limiter: Đăng nhập, đăng ký, gửi OTP
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Quá nhiều yêu cầu xác thực, vui lòng thử lại sau 15 phút' },
  });

  // 2d. General Limiter: Áp dụng cho các route duyệt web thông thường (Catalog, Stores...)
  // Tự động bỏ qua các route đã có limiter chuyên biệt để chống double-limiting
  const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 600,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
      const p = req.originalUrl || req.url || '';
      return (
        p.includes('/api/payments/payos/webhook') ||
        p.includes('/api/orders/lookup') ||
        p.includes('/api/orders/track') ||
        p.includes('/api/payments/payos/status') ||
        p.includes('/api/auth') ||
        p.includes('/admin/login') ||
        (req.method === 'POST' && (p.includes('/api/orders') || p.includes('/api/vouchers/apply')))
      );
    },
    message: { error: 'Quá nhiều yêu cầu, vui lòng thử lại sau' },
  });

  // Gắn limiter chuyên biệt cho từng nhóm endpoint
  app.get('/api/orders/lookup', pollingLimiter);
  app.get('/api/orders/track', pollingLimiter);
  app.get('/api/payments/payos/status', pollingLimiter);

  app.post('/api/orders', orderMutationLimiter);
  app.post('/api/orders/cancel', orderMutationLimiter);
  app.post('/api/orders/:id/cancel', orderMutationLimiter);
  app.post('/api/vouchers/apply', orderMutationLimiter);

  app.use('/admin/login', authLimiter);
  app.use('/api/auth', authLimiter);

  // General limiter cho toàn bộ /api còn lại
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
