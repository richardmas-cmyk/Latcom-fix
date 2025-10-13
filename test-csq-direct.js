/**
 * Direct CSQ API Test
 * Testing with different operator IDs based on Adriana's format
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

console.log('CSQ Test Configuration:');
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

        console.log(`\n→ ${method} ${path}`);
        if (data) {
            console.log('  Payload:', JSON.stringify(data, null, 2));
        }

        const response = await axios(requestConfig);
        return { success: true, data: response.data };

    } catch (error) {
        if (error.response) {
            return {
                success: false,
                status: error.response.status,
                data: error.response.data
            };
        }
        throw error;
    }
}

async function testTopup() {
    console.log('🧪 Testing CSQ Topup with Different Operator IDs\n');
    console.log('='.repeat(80));

    // Test phone: 5527642763 (Telcel)
    const phone = '5527642763';
    const amount = 20; // MXN

    // Adriana's format
    const payload = {
        "localDateTime": new Date().toISOString().slice(0, 19),
        "account": phone,
        "amountToSendX100": 2000 // 20 MXN in cents
    };

    // Try different operator/SKU IDs
    const operatorsToTest = [
        { id: '1', name: 'Operator 1 (Telcel generic)' },
        { id: '396', name: 'SKU 396 (Telcel)' },
        { id: '2', name: 'Operator 2 (Movistar)' },
        { id: '3', name: 'Operator 3 (AT&T)' },
        { id: '683', name: 'SKU 683 (Amigo Sin Limites)' },
        { id: '684', name: 'SKU 684 (Internet Amigo)' }
    ];

    for (const op of operatorsToTest) {
        console.log(`\n${'='.repeat(80)}`);
        console.log(`Testing: ${op.name}`);
        console.log('='.repeat(80));

        const localRef = String(Date.now()).slice(-8);
        const endpoint = `/pre-paid/recharge/purchase/${config.terminalId}/${op.id}/${localRef}`;

        const result = await makeRequest('POST', endpoint, payload);

        if (result.success) {
            console.log('\n✅ SUCCESS!');
            console.log('Response:', JSON.stringify(result.data, null, 2));

            // If successful, stop testing
            console.log('\n🎉 Found working operator:', op.name);
            break;
        } else {
            console.log('\n❌ FAILED');
            console.log('Status:', result.status);
            console.log('Response:', JSON.stringify(result.data, null, 2));
        }
    }

    console.log('\n' + '='.repeat(80));
    console.log('🏁 Test Complete\n');
}

// Run
testTopup().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
