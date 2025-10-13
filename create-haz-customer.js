/**
 * Create HAZ Customer Account
 * Adds HAZ group to the customer database with initial credentials
 */

require('dotenv').config({ path: '.env.staging' });
const { createPool } = require('./database-config');

async function createHAZCustomer() {
    console.log('Creating HAZ customer account...\n');

    const pool = createPool();

    if (!pool) {
        console.error('❌ Database not configured');
        process.exit(1);
    }

    try {
        // Test database connection
        await pool.query('SELECT NOW()');
        console.log('✅ Database connected\n');

        // Customer details
        const customerId = 'HAZ_001';
        const companyName = 'HAZ Group';
        const apiKey = 'haz_prod_2025';
        const secretKey = 'HAZ!gr0up#2025$';
        const creditLimit = 10000; // $10,000 USD initial credit
        const currentBalance = 10000;

        // Check if customer already exists
        const existsResult = await pool.query(
            'SELECT * FROM customers WHERE customer_id = $1',
            [customerId]
        );

        if (existsResult.rows.length > 0) {
            console.log('⚠️  HAZ customer already exists. Updating...\n');

            await pool.query(
                `UPDATE customers
                 SET company_name = $1,
                     api_key = $2,
                     secret_key = $3,
                     credit_limit = $4,
                     current_balance = $5,
                     is_active = true
                 WHERE customer_id = $6
                 RETURNING *`,
                [companyName, apiKey, secretKey, creditLimit, currentBalance, customerId]
            );

            console.log('✅ HAZ customer updated successfully');
        } else {
            // Create new customer
            const result = await pool.query(
                `INSERT INTO customers
                 (customer_id, company_name, api_key, secret_key, credit_limit, current_balance, is_active)
                 VALUES ($1, $2, $3, $4, $5, $6, true)
                 RETURNING *`,
                [customerId, companyName, apiKey, secretKey, creditLimit, currentBalance]
            );

            console.log('✅ HAZ customer created successfully');
        }

        // Display credentials
        console.log('\n' + '='.repeat(80));
        console.log('HAZ GROUP CREDENTIALS');
        console.log('='.repeat(80));
        console.log('');
        console.log('Company Name:', companyName);
        console.log('Customer ID:', customerId);
        console.log('API Key:', apiKey);
        console.log('Secret Key:', secretKey);
        console.log('Credit Limit: $' + creditLimit + ' USD');
        console.log('Current Balance: $' + currentBalance + ' USD');
        console.log('Status: ACTIVE');
        console.log('');
        console.log('='.repeat(80));
        console.log('');
        console.log('📝 API Usage:');
        console.log('');
        console.log('Headers:');
        console.log('  x-api-key: ' + apiKey);
        console.log('  x-customer-id: ' + customerId);
        console.log('  Content-Type: application/json');
        console.log('');
        console.log('Example Request:');
        console.log('');
        console.log('curl -X POST https://latcom-fix-production.up.railway.app/api/enviadespensa/topup \\');
        console.log('  -H "Content-Type: application/json" \\');
        console.log('  -H "x-api-key: ' + apiKey + '" \\');
        console.log('  -H "x-customer-id: ' + customerId + '" \\');
        console.log('  -d \'{"phone":"5566374683","amount":20}\'');
        console.log('');
        console.log('='.repeat(80));
        console.log('');
        console.log('💡 Available Products (Latcom XOOM):');
        console.log('   10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 150, 200, 300, 500 MXN');
        console.log('');
        console.log('🔒 Security Notes:');
        console.log('   - API calls are rate-limited to 200 requests/minute');
        console.log('   - Daily transaction limit: 5,000 MXN per customer');
        console.log('   - Max single transaction: 500 MXN');
        console.log('   - Balance is maintained in USD (auto-converted from MXN at current rate)');
        console.log('');
        console.log('📊 Monitoring:');
        console.log('   - Dashboard: https://latcom-fix-production.up.railway.app/dashboard');
        console.log('   - Health: https://latcom-fix-production.up.railway.app/health');
        console.log('');
        console.log('='.repeat(80));

        await pool.end();
        console.log('\n✅ Customer setup complete\n');

    } catch (error) {
        console.error('❌ Error creating customer:', error.message);
        process.exit(1);
    }
}

createHAZCustomer();
