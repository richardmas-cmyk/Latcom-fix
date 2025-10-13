/**
 * Add IP Whitelisting Support to Customers Table
 * Adds allowed_ips column for IP-based security
 */

require('dotenv').config({ path: '.env.staging' });
const { createPool } = require('./database-config');

async function addIPWhitelistSupport() {
    console.log('Adding IP whitelist support to customers table...\n');

    const pool = createPool();

    if (!pool) {
        console.error('❌ Database not configured');
        process.exit(1);
    }

    try {
        // Test database connection
        await pool.query('SELECT NOW()');
        console.log('✅ Database connected\n');

        // Add allowed_ips column (JSONB array)
        try {
            await pool.query(`
                ALTER TABLE customers
                ADD COLUMN IF NOT EXISTS allowed_ips JSONB DEFAULT '[]'::jsonb
            `);
            console.log('✅ Added allowed_ips column to customers table');
        } catch (error) {
            console.log('⚠️  Column may already exist:', error.message);
        }

        // Add ip_whitelist_enabled flag
        try {
            await pool.query(`
                ALTER TABLE customers
                ADD COLUMN IF NOT EXISTS ip_whitelist_enabled BOOLEAN DEFAULT false
            `);
            console.log('✅ Added ip_whitelist_enabled flag to customers table');
        } catch (error) {
            console.log('⚠️  Column may already exist:', error.message);
        }

        console.log('\n✅ IP whitelist support added successfully\n');

        // Display usage
        console.log('='.repeat(80));
        console.log('IP WHITELIST USAGE');
        console.log('='.repeat(80));
        console.log('');
        console.log('To enable IP whitelisting for a customer:');
        console.log('');
        console.log('UPDATE customers');
        console.log('SET ip_whitelist_enabled = true,');
        console.log('    allowed_ips = \'["1.2.3.4", "5.6.7.8"]\'::jsonb');
        console.log('WHERE customer_id = \'HAZ_001\';');
        console.log('');
        console.log('To disable IP whitelisting:');
        console.log('');
        console.log('UPDATE customers');
        console.log('SET ip_whitelist_enabled = false');
        console.log('WHERE customer_id = \'HAZ_001\';');
        console.log('');
        console.log('='.repeat(80));

        await pool.end();

    } catch (error) {
        console.error('❌ Error adding IP whitelist support:', error.message);
        process.exit(1);
    }
}

addIPWhitelistSupport();
