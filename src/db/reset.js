// ============================================================================
// File: src/db/reset.js
// Owner: Dhruv (Database & Auth)
// Purpose: Full local reset — drop every table, recreate the schema and load
//          the demo dataset. Run via: npm run db:reset
//
// Viva Note: this is the only supported way to clear test pollution. The test
// suites create real rows (Aggregation Kitchen ..., Test Ingredient ..., etc.)
// in whatever database DB_NAME points at, and `db:seed` is intentionally
// idempotent, so it cannot remove them. `db:reset` drops the tables first.
// ============================================================================

const dotenv = require('dotenv');
const runMigration = require('./migrate');
const { runSeed } = require('./seed');
const prisma = require('./prisma');

dotenv.config();

async function runReset() {
  console.log('[Reset] Dropping and recreating the CoBuy schema...');
  await runMigration();

  console.log('[Reset] Loading demo data...');
  await runSeed();

  console.log('[Reset] Database is clean: schema recreated + demo data seeded.');
}

if (require.main === module) {
  runReset()
    .catch((error) => {
      console.error('[Reset] Failed:', error.message);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

module.exports = runReset;
