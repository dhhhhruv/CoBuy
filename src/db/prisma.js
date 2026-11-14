// ============================================================================
// File: src/db/prisma.js
// Owner: Dhruv (Database & Auth)
// Purpose: Singleton PrismaClient instance for ORM queries and raw spatial execution.
// ============================================================================

const { PrismaClient } = require('@prisma/client');

// Viva Note: We maintain a single instance of PrismaClient across the app.
// Creating multiple PrismaClient instances would create multiple distinct connection pools
// and risk exhausting MySQL's max_connections.
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error']
});

module.exports = prisma;

