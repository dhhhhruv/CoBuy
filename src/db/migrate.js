// ============================================================================
// File: src/db/migrate.js
// Owner: Dhruv (Database & Auth)
// Purpose: Schema migration runner that executes src/db/schema.sql in MySQL.
// Run via: npm run db:migrate
// ============================================================================

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config();

async function runMigration() {
  console.log('[Migration] Starting CoBuy database schema migration...');

  // Create an initial administrative connection without selecting cobuy_db,
  // in case the database has not been created yet on MySQL server.
  const adminConnection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true // Allows executing multi-statement SQL scripts
  });

  try {
    const schemaPath = path.join(__dirname, 'schema.sql');
    const sqlScript = fs.readFileSync(schemaPath, 'utf8');

    console.log(`[Migration] Reading schema file from: ${schemaPath}`);
    console.log('[Migration] Executing schema DDL statements...');

    await adminConnection.query(sqlScript);

    console.log('[Migration] ✅ Schema migration completed successfully!');
    console.log('[Migration] Created 8 tables: users, user_roles, restaurants, suppliers, products, supplier_catalogue, buying_pools, micro_orders.');
  } catch (error) {
    console.error('[Migration] ❌ Migration failed with error:');
    console.error(error.message);
    process.exit(1);
  } finally {
    await adminConnection.end();
  }
}

if (require.main === module) {
  runMigration();
}

module.exports = runMigration;

