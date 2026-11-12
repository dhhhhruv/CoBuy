// ============================================================================
// File: src/app.js
// Owner: Dhruv (Database & Auth)
// Purpose: Main Express application server and health-check route.
// ============================================================================

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { testConnection } = require('./db/connection');

// Load environment configuration
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// ----------------------------------------------------------------------------
// Middleware Explanation (Viva Notes):
// 1. cors(): Enables Cross-Origin Resource Sharing so Debangshu's frontend
//    running on a different port can communicate with this API.
// 2. express.json(): Built-in body parser that converts raw incoming JSON payloads
//    in the HTTP request body into accessible JavaScript objects on req.body.
// ----------------------------------------------------------------------------
app.use(cors());
app.use(express.json());

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

// Start the server if this file is executed directly
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`[CoBuy Backend] Server is running on http://localhost:${PORT}`);
    console.log(`[CoBuy Backend] Health check available at http://localhost:${PORT}/health`);
  });
}

module.exports = app;

