// ============================================================================
// File: src/app.js
// Owner: Dhruv (Database & Auth)
// Purpose: Main Express application server and health-check route.
// ============================================================================

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const { testConnection } = require('./db/connection');
const prisma = require('./db/prisma');
const authRoutes = require('./auth/authRoutes');
const restaurantRoutes = require('./profiles/restaurantRoutes');
const supplierRoutes = require('./profiles/supplierRoutes');
const productRoutes = require('./catalogue/productRoutes');
const catalogueRoutes = require('./catalogue/catalogueRoutes');
const poolRoutes = require('./pools/poolRoutes');
const orderRoutes = require('./orders/orderRoutes');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

// Load environment configuration
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// ----------------------------------------------------------------------------
// Middleware Explanation (Viva Notes):
// 1. cors(): Allow-list only. The SPA is served from this same origin, so no
//    cross-origin access is needed in production. Additional trusted origins
//    must be listed explicitly in CORS_ORIGINS (comma separated).
// 2. express.json(): Built-in body parser that converts raw incoming JSON payloads
//    in the HTTP request body into accessible JavaScript objects on req.body.
// 3. express.static(): Serves Debangshu's SPA frontend from src/client.
// ----------------------------------------------------------------------------
const normalizeOrigin = (origin) => String(origin).trim().replace(/\/+$/, '').toLowerCase();

const allowedOrigins = new Set(
  [
    `http://localhost:${PORT}`,
    `http://127.0.0.1:${PORT}`,
    ...(process.env.CORS_ORIGINS || '').split(',')
  ]
    .map((origin) => origin && normalizeOrigin(origin))
    .filter(Boolean)
);

app.use(cors({
  origin(origin, callback) {
    // No Origin header: same-origin navigation, curl, server-to-server.
    if (!origin) return callback(null, true);
    return callback(null, allowedOrigins.has(normalizeOrigin(origin)));
  },
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'client')));

// ----------------------------------------------------------------------------
// API Routes:
// ----------------------------------------------------------------------------
app.use('/api/users', authRoutes);
app.use('/api/restaurants', restaurantRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/products', productRoutes);
app.use('/api/catalogue', catalogueRoutes);
app.use('/api/pools', poolRoutes);
app.use('/api/orders', orderRoutes);

// ----------------------------------------------------------------------------
// Health Check Route: GET /health
// Purpose: Verifies whether the Node.js API server is running and whether
// it can successfully reach and query the MySQL database.
// ----------------------------------------------------------------------------
app.get('/health', async (req, res) => {
  const dbStatus = await testConnection();

  const responsePayload = {
    status: dbStatus.connected ? 'healthy' : 'degraded',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    services: {
      apiServer: 'UP',
      database: dbStatus.connected ? 'CONNECTED' : 'DISCONNECTED'
    }
  };

  if (!dbStatus.connected) {
    responsePayload.databaseError = dbStatus.error;
    // Return 503 Service Unavailable if database is unreachable
    return res.status(503).json(responsePayload);
  }

  return res.status(200).json(responsePayload);
});

// ----------------------------------------------------------------------------
// 404 Route Not Found & Global Centralized Error Handler
// ----------------------------------------------------------------------------
app.use(notFoundHandler);
app.use(errorHandler);

// Start the server if this file is executed directly
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`[CoBuy Backend] Server is running on http://localhost:${PORT}`);
    console.log(`[CoBuy Backend] Health check available at http://localhost:${PORT}/health`);
  });
}

module.exports = app;

