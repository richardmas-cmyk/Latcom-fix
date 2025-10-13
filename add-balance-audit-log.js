/**
 * Add Balance Adjustments Audit Log
 * Tracks all balance changes with timestamp, reason, and admin who made the change
 */

require('dotenv').config({ path: '.env.staging' });
const { createPool } = require('./database-config');

async function addBalanceAuditLog() {
    console.log('Adding balance adjustments audit log table...\n');

    const pool = createPool();

    if (!pool) {
        console.error('❌ Database not configured');
        process.exit(1);
    }

    try {
        // Test database connection
        await pool.query('SELECT NOW()');
        console.log('✅ Database connected\n');

        // Create balance_adjustments table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS balance_adjustments (
                id SERIAL PRIMARY KEY,
                customer_id VARCHAR(50) NOT NULL,
                amount DECIMAL(10,2) NOT NULL,
                balance_before DECIMAL(10,2) NOT NULL,
                balance_after DECIMAL(10,2) NOT NULL,
                reason TEXT,
                adjusted_by VARCHAR(100) DEFAULT 'ADMIN',
                created_at TIMESTAMP DEFAULT NOW(),
                FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
            )
        `);
        console.log('✅ Created balance_adjustments table');

        // Create index for faster queries by customer
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_balance_adjustments_customer
            ON balance_adjustments(customer_id)
        `);
        console.log('✅ Created index on customer_id');

        // Create index for date queries
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_balance_adjustments_date
            ON balance_adjustments(created_at DESC)
        `);
        console.log('✅ Created index on created_at');

        console.log('\n✅ Balance audit log system added successfully\n');

        // Display usage
        console.log('='.repeat(80));
        console.log('BALANCE AUDIT LOG USAGE');
        console.log('='.repeat(80));
        console.log('');
        console.log('The system will now automatically track all balance adjustments.');
        console.log('');
        console.log('View adjustment history for a customer:');
        console.log('');
        console.log('SELECT * FROM balance_adjustments');
        console.log('WHERE customer_id = \'HAZ_001\'');
        console.log('ORDER BY created_at DESC;');
        console.log('');
        console.log('View all adjustments in the last 30 days:');
        console.log('');
        console.log('SELECT ba.*, c.company_name');
        console.log('FROM balance_adjustments ba');
        console.log('JOIN customers c ON ba.customer_id = c.customer_id');
        console.log('WHERE ba.created_at >= NOW() - INTERVAL \'30 days\'');
        console.log('ORDER BY ba.created_at DESC;');
        console.log('');
        console.log('='.repeat(80));

        await pool.end();

    } catch (error) {
        console.error('❌ Error adding balance audit log:', error.message);
        process.exit(1);
    }
}

addBalanceAuditLog();
