/**
 * Run database index migrations
 * Phase 2: Performance optimization for high volume
 */

const { createPool } = require('../database-config');
const fs = require('fs');
const path = require('path');

async function runIndexMigration() {
    const pool = createPool();

    if (!pool) {
        console.log('❌ Database not configured');
        return false;
    }

    try {
        console.log('🔧 Running index migrations...');

        // Read SQL file
        const sqlPath = path.join(__dirname, 'add-indexes.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        // Execute migration
        await pool.query(sql);

        console.log('✅ Index migration completed successfully');

        // Get index count
        const result = await pool.query(`
            SELECT schemaname, tablename, COUNT(*) as index_count
            FROM pg_indexes
            WHERE schemaname = 'public'
            GROUP BY schemaname, tablename
            ORDER BY tablename
        `);

        console.log('📊 Index Summary:');
        result.rows.forEach(row => {
            console.log(`   - ${row.tablename}: ${row.index_count} indexes`);
        });

        await pool.end();
        return true;

    } catch (error) {
        console.error('❌ Index migration error:', error.message);
        await pool.end();
        return false;
    }
}

// Run if called directly
if (require.main === module) {
    runIndexMigration()
        .then(success => {
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error('Fatal error:', error);
            process.exit(1);
        });
}

module.exports = { runIndexMigration };
