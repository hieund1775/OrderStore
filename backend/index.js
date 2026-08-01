import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import swaggerSpec from './config/swagger.js';
import publicRoutes from './routes/public.js';
import adminRoutes from './routes/admin.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'TeaPlus API Docs',
}));
app.get('/api-docs.json', (req, res) => res.json(swaggerSpec));

// ─────────────────────────────────────────────
// Public API           → /api/*
// Admin API            → /admin/*
// ─────────────────────────────────────────────
app.use('/api',   publicRoutes);
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
