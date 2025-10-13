/**
 * Enable IP Whitelisting for Customer
 * Usage: railway run node enable-ip-whitelist.js <customer_id> <ip1,ip2,ip3>
 */

require('dotenv').config({ path: '.env.staging' });
const { createPool } = require('./database-config');

async function enableIPWhitelist() {
    const args = process.argv.slice(2);

    if (args.length < 2) {
        console.error('Usage: node enable-ip-whitelist.js <customer_id> <ip1,ip2,ip3>');
        console.error('');
        console.error('Examples:');
        console.error('  node enable-ip-whitelist.js HAZ_001 203.0.113.10');
        console.error('  node enable-ip-whitelist.js HAZ_001 203.0.113.10,203.0.113.20');
        console.error('  railway run node enable-ip-whitelist.js HAZ_001 203.0.113.10');
        process.exit(1);
    }

    const customerId = args[0];
    const ipsString = args[1];
    const ips = ipsString.split(',').map(ip => ip.trim());

    console.log(`\nEnabling IP whitelist for ${customerId}...`);
    console.log(`IPs to whitelist: ${ips.join(', ')}\n`);

    const pool = createPool();

    if (!pool) {
        console.error('❌ Database not configured');
        process.exit(1);
    }

    try {
        await pool.query('SELECT NOW()');
        console.log('✅ Database connected\n');

        // Check if customer exists
        const customerResult = await pool.query(
            'SELECT * FROM customers WHERE customer_id = $1',
            [customerId]
        );

        if (customerResult.rows.length === 0) {
            console.error(`❌ Customer ${customerId} not found`);
            process.exit(1);
        }

        const customer = customerResult.rows[0];
        console.log(`Found customer: ${customer.company_name}`);
        console.log('');

        // Update customer with IP whitelist
        await pool.query(
            'UPDATE customers SET ip_whitelist_enabled = true, allowed_ips = $1::jsonb WHERE customer_id = $2',
            [JSON.stringify(ips), customerId]
        );

        console.log('✅ IP whitelist enabled successfully\n');

        // Display configuration
        console.log('='.repeat(80));
        console.log('IP WHITELIST CONFIGURATION');
        console.log('='.repeat(80));
        console.log('');
        console.log('Customer ID:', customerId);
        console.log('Company:', customer.company_name);
        console.log('Status: ENABLED');
        console.log('Whitelisted IPs:');
        ips.forEach((ip, index) => {
            console.log(`  ${index + 1}. ${ip}`);
        });
        console.log('');
        console.log('='.repeat(80));
        console.log('');
        console.log('🔒 Security Active:');
        console.log('   Only requests from the above IP addresses will be accepted.');
        console.log('   Requests from other IPs will receive: "IP address not authorized"');
        console.log('');
        console.log('📝 To test from allowed IP:');
        console.log('');
        console.log(`   curl -X POST https://latcom-fix-production.up.railway.app/api/enviadespensa/topup \\`);
        console.log(`     -H "Content-Type: application/json" \\`);
        console.log(`     -H "x-api-key: ${customer.api_key}" \\`);
        console.log(`     -H "x-customer-id: ${customerId}" \\`);
        console.log(`     -d '{"phone":"5566374683","amount":20}'`);
        console.log('');
        console.log('📝 To disable IP whitelisting:');
        console.log('');
        console.log(`   UPDATE customers SET ip_whitelist_enabled = false WHERE customer_id = '${customerId}';`);
        console.log('');
        console.log('📝 To add more IPs:');
        console.log('');
        console.log(`   node enable-ip-whitelist.js ${customerId} ${ips.join(',')},NEW_IP`);
        console.log('');
        console.log('='.repeat(80));

        await pool.end();
        console.log('\n✅ IP whitelist setup complete\n');

    } catch (error) {
        console.error('❌ Error enabling IP whitelist:', error.message);
        process.exit(1);
    }
}

enableIPWhitelist();
