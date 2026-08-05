import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import swaggerSpec from './config/swagger.js';
import publicRoutes from './routes/public.js';
import adminRoutes from './routes/admin.js';
import authRoutes from './routes/auth.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// ─── Security Middleware (OWASP) ───
app.use(helmet());

const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:3000,http://localhost:3001,http://localhost:5173')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
app.use(cors({ origin: allowedOrigins }));

const sensitiveLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Quá nhiều yêu cầu, vui lòng thử lại sau 15 phút' },
});
app.use('/api/orders', sensitiveLimiter);
app.use('/api/vouchers/apply', sensitiveLimiter);
app.use('/admin/login', sensitiveLimiter);

app.use(express.json());

// Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'TeaPlus API Docs',
}));
app.get('/api-docs.json', (req, res) => res.json(swaggerSpec));

// ─────────────────────────────────────────────
// Public API           → /api/*
// Admin API            → /admin/*  (auth: POST /admin/login public, còn lại cần JWT)
// ─────────────────────────────────────────────
app.use('/api',   publicRoutes);
app.use('/admin', authRoutes);
app.use('/admin', adminRoutes);

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
