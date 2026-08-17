import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { PORT, allowedOrigins } from './config/env.js';
import swaggerUi from 'swagger-ui-express';
import swaggerSpec from './config/swagger.js';
import publicRoutes from './routes/public.js';
import adminRoutes from './routes/admin.js';
import authRoutes from './routes/auth.js';
import customerAuthRoutes from './routes/customerAuth.js';
import paymentRoutes, { handlePayOSWebhook } from './routes/payments.js';
import { expireUnpaidPayOSOrders } from './services/payment-state.js';
import db from './config/db.js';

const app = express();

// ─── Security Middleware (OWASP) ───
app.use(helmet());
app.use(cors({ origin: allowedOrigins }));

app.use(express.json());

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
// 3) Payment Status & Lookup APIs (protected by general limiter)
// ─────────────────────────────────────────────
app.use('/api/payments', paymentRoutes);

// Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'TeaPlus API Docs',
}));
app.get('/api-docs.json', (req, res) => res.json(swaggerSpec));

// ─────────────────────────────────────────────
// Customer Auth API    → /api/auth/*
// Public API           → /api/*
// Admin API            → /admin/*  (auth: POST /admin/login public, còn lại cần JWT)
// ─────────────────────────────────────────────
app.use('/api/auth', customerAuthRoutes);
app.use('/api',   publicRoutes);
app.use('/admin', authRoutes);
app.use('/admin', adminRoutes);

// Auto-expire sweep unpaid PayOS orders every 60s with error handling
setInterval(async () => {
  try {
    await expireUnpaidPayOSOrders();
  } catch (err) {
    console.error('❌ [AutoExpire Scheduler Error]:', err.message || err);
  }
}, 60000);

// 404 fallback
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.originalUrl} not found` });
});

// Start server
app.listen(PORT, () => {
  console.log(`🍵 TeaPlus API running at http://localhost:${PORT}`);
  console.log(`   Swagger: http://localhost:${PORT}/api-docs`);
  console.log(`   Public:  http://localhost:${PORT}/api/health`);
  console.log(`   Admin:   http://localhost:${PORT}/admin/dashboard/kpi`);
});

export default app;