// ============================================================================
// File: src/db/connection.js
// Owner: Dhruv (Database & Auth)
// Purpose: Configures and exports a MySQL connection pool using mysql2/promise.
// ============================================================================

const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

// Load environment variables from .env file
dotenv.config();

// Create a connection pool rather than a single connection.
// Viva Note: A connection pool keeps a pool of reusable connections open.
// Creating a new TCP connection for every incoming HTTP request is expensive.
// The pool reuses existing connections, improving speed and handling concurrent users.
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'cobuy_db',
  waitForConnections: true,
  connectionLimit: 10, // Max simultaneous connections allowed in the pool
  queueLimit: 0        // Unlimited queued connection requests when all 10 are busy
});

// Helper function to test database connectivity (used by the health check)
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release(); // Always release the connection back to the pool
    return { connected: true, message: 'Database connection successful' };
  } catch (error) {
    return { connected: false, error: error.message };
  }
}

module.exports = {
  pool,
  testConnection
};

