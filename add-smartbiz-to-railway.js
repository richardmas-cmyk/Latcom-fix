#!/usr/bin/env node
/**
 * Add SmartBiz Telecom Customer to Production Database
 * Run this on Railway: railway run node add-smartbiz-to-railway.js
 */

const { createPool } = require('./database-config');

async function addSmartBizTelecom() {
    console.log('🚀 Adding SmartBiz Telecom to database...\n');

    const pool = createPool();

    if (!pool) {
        console.error('❌ No database connection available');
        console.error('Make sure DATABASE_URL is set in your environment');
        process.exit(1);
    }

    try {
        // Test connection
        const testResult = await pool.query('SELECT NOW()');
        console.log('✅ Database connected:', testResult.rows[0].now);
        console.log('');

        // Insert SmartBiz Telecom customer
        const result = await pool.query(`
            INSERT INTO customers (
                customer_id,
                company_name,
                api_key,
                secret_key,
                credit_limit,
                current_balance,
                commission_percentage,
                is_active,
                created_at
            ) VALUES (
                'SMARTBIZ_001',
                'SmartBiz Telecom',
                'smartbiz_prod_7d086ce74101615476169835689efbcd',
                'SBT_545970e108537acd351c88ef1d8f572e52c6422058204102',
                50000.00,
                50000.00,
                0.00,
                true,
                NOW()
            ) ON CONFLICT (customer_id) DO UPDATE SET
                api_key = EXCLUDED.api_key,
                secret_key = EXCLUDED.secret_key,
                credit_limit = EXCLUDED.credit_limit,
                current_balance = EXCLUDED.current_balance,
                commission_percentage = EXCLUDED.commission_percentage,
                is_active = EXCLUDED.is_active
            RETURNING *
        `);

        console.log('✅ SUCCESS! SmartBiz Telecom added to database!\n');
        console.log('═══════════════════════════════════════════════════════════');
        console.log('Customer Details:');
        console.log('═══════════════════════════════════════════════════════════');
        console.log('Customer ID:       ', result.rows[0].customer_id);
        console.log('Company Name:      ', result.rows[0].company_name);
        console.log('API Key:           ', result.rows[0].api_key);
        console.log('Secret Key:        ', result.rows[0].secret_key);
        console.log('Credit Limit:       $' + result.rows[0].credit_limit.toLocaleString() + ' USD');
        console.log('Current Balance:    $' + result.rows[0].current_balance.toLocaleString() + ' USD');
        console.log('Commission:        ', result.rows[0].commission_percentage + '%');
        console.log('Status:            ', result.rows[0].is_active ? 'Active ✅' : 'Inactive ❌');
        console.log('Created At:        ', result.rows[0].created_at);
        console.log('═══════════════════════════════════════════════════════════\n');

        // Verify by querying back
        const verify = await pool.query(
            'SELECT customer_id, company_name, current_balance, is_active FROM customers WHERE customer_id = $1',
            ['SMARTBIZ_001']
        );

        if (verify.rows.length > 0) {
            console.log('✅ Verification successful - Customer exists in database\n');
        } else {
            console.log('⚠️  Warning: Could not verify customer creation\n');
        }

        await pool.end();

        console.log('🎉 All done! SmartBiz Telecom is ready to use the API.\n');
        console.log('Next steps:');
        console.log('1. Share SMARTBIZ_API_INTEGRATION.md with the customer');
        console.log('2. Share SMARTBIZ_QUICK_REFERENCE.md for quick access');
        console.log('3. Test the API with their credentials\n');

    } catch (error) {
        console.error('\n❌ Error adding customer:', error.message);

        if (error.code === '42P01') {
            console.error('\nThe customers table does not exist.');
            console.error('Run database initialization first.');
        } else if (error.code === '23505') {
            console.error('\nCustomer SMARTBIZ_001 already exists.');
            console.error('The ON CONFLICT clause should have handled this - check your database.');
        } else {
            console.error('\nDatabase error code:', error.code);
            console.error('Details:', error.detail || 'No additional details');
        }

        process.exit(1);
    }
}

// Run the function
addSmartBizTelecom().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
