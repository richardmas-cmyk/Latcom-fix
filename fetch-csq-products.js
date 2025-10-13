/**
 * Fetch CSQ Products for Mexico
 * Gets all available products/operators/SKUs from CSQ
 */

require('dotenv').config({ path: '.env.staging' });
const axios = require('axios');
const crypto = require('crypto');

// CSQ Configuration
const config = {
    baseUrl: process.env.CSQ_BASE_URL || 'https://evsbus.csqworld.com',
    username: process.env.CSQ_USERNAME,
    password: process.env.CSQ_PASSWORD,
    terminalId: process.env.CSQ_TERMINAL_ID
};

console.log('CSQ Configuration:');
console.log('  Base URL:', config.baseUrl);
console.log('  Username:', config.username);
console.log('  Terminal:', config.terminalId);
console.log('');

// Generate auth headers
function generateAuthHeaders() {
    const ST = Math.floor(Date.now() / 1000).toString();
    const password = config.password;

    const pass_sha = crypto.createHash('sha256').update(password).digest('hex');
    const salt_sha = crypto.createHash('sha256').update(ST).digest('hex');
    const SH = crypto.createHash('sha256').update(pass_sha + salt_sha).digest('hex');

    return {
        'U': config.username,
        'ST': ST,
        'SH': SH,
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip',
        'Content-Type': 'application/json',
        'X-Real-Ip': '0.0.0.0',
        'Cache-Hash': '0',
        'Agent': 'Relier-Hub/1.0'
    };
}

async function makeRequest(method, path, data = null) {
    const url = `${config.baseUrl}${path}`;
    const headers = generateAuthHeaders();

    try {
        const requestConfig = {
            method: method,
            url: url,
            headers: headers,
            timeout: 60000
        };

        if (data && (method === 'POST' || method === 'PUT')) {
            requestConfig.data = data;
        }

        const response = await axios(requestConfig);
        return response.data;

    } catch (error) {
        if (error.response) {
            console.error('API Error:', error.response.status, error.response.data);
            throw new Error(`CSQ API error: ${error.response.data?.message || error.response.statusText}`);
        }
        throw error;
    }
}

async function fetchProducts() {
    console.log('\n🔍 Fetching CSQ Products for Mexico\n');
    console.log('='.repeat(80));

    try {
        // Test authentication first
        console.log('\n1️⃣  Testing Authentication...');
        const balances = await makeRequest('GET', '/external-point-of-sale/by-file/balances');

        if (balances && balances.items) {
            console.log('✅ Authentication successful!');
            console.log('   Balance:', balances.items[0]?.balance || 0, balances.items[0]?.currency || 'USD');
        }

        // Get list of operators/products
        // CSQ doesn't have a direct "list all products" endpoint
        // But we can try different endpoints

        console.log('\n2️⃣  Attempting to fetch operator list...');

        // Try various endpoints to get product information
        const endpoints = [
            '/pre-paid/recharge/operators',
            '/external-point-of-sale/by-file/operators',
            '/pre-paid/operators',
            '/operators',
            '/products',
            '/catalogue',
        ];

        for (const endpoint of endpoints) {
            try {
                console.log(`\n   Trying: ${endpoint}`);
                const result = await makeRequest('GET', endpoint);

                if (result) {
                    console.log('   ✅ Success! Found data:');
                    console.log(JSON.stringify(result, null, 2));
                    console.log('');
                }
            } catch (error) {
                console.log(`   ❌ ${endpoint} - ${error.message}`);
            }
        }

        // Try getting parameters for known Mexican operators
        console.log('\n3️⃣  Trying known Mexican operator IDs...');

        const knownOperators = [
            { id: '1', name: 'Telcel (assumed)' },
            { id: '396', name: 'Telcel SKU' },
            { id: '683', name: 'Amigo Sin Limites' },
            { id: '684', name: 'Internet Amigo' },
            { id: '2', name: 'Movistar (assumed)' },
            { id: '3', name: 'AT&T (assumed)' },
        ];

        const workingOperators = [];

        for (const op of knownOperators) {
            try {
                console.log(`\n   Testing operator ${op.id} (${op.name})...`);

                // Try to get parameters
                const params = await makeRequest(
                    'GET',
                    `/pre-paid/recharge/parameters/${config.terminalId}/${op.id}`
                );

                if (params) {
                    console.log(`   ✅ Operator ${op.id} is available!`);
                    workingOperators.push({
                        id: op.id,
                        name: op.name,
                        parameters: params
                    });
                    console.log('   Parameters:', JSON.stringify(params, null, 2));
                }
            } catch (error) {
                console.log(`   ❌ Operator ${op.id} - ${error.message}`);
            }
        }

        // Try to get products for working operators
        if (workingOperators.length > 0) {
            console.log('\n4️⃣  Fetching products for working operators...');

            for (const op of workingOperators) {
                try {
                    console.log(`\n   Getting products for operator ${op.id} (${op.name})...`);

                    const products = await makeRequest(
                        'GET',
                        `/pre-paid/recharge/products/${config.terminalId}/${op.id}`
                    );

                    if (products) {
                        console.log(`   ✅ Products found for operator ${op.id}:`);
                        console.log(JSON.stringify(products, null, 2));
                    }
                } catch (error) {
                    console.log(`   ❌ Products for ${op.id} - ${error.message}`);
                }
            }
        }

        console.log('\n' + '='.repeat(80));
        console.log('\n📊 Summary of Working Operators:');
        if (workingOperators.length > 0) {
            workingOperators.forEach(op => {
                console.log(`  - ${op.id}: ${op.name}`);
            });
        } else {
            console.log('  No operators found. CSQ may require different API approach.');
        }

        console.log('\n💡 Note: CSQ typically provides product info via:');
        console.log('   1. Get Parameters endpoint (lists available products)');
        console.log('   2. Direct SKU usage (like 396 for Telcel)');
        console.log('   3. Contact CSQ support for full product catalog\n');

    } catch (error) {
        console.error('\n❌ Error:', error.message);
    }

    console.log('='.repeat(80));
    console.log('🏁 Product fetch complete\n');
}

// Run
fetchProducts().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
