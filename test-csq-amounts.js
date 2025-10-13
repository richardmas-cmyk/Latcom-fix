/**
 * Test CSQ with different amounts
 * Maybe the development terminal has amount restrictions
 */

require('dotenv').config({ path: '.env.staging' });
const axios = require('axios');
const crypto = require('crypto');

const config = {
    baseUrl: process.env.CSQ_BASE_URL || 'https://evsbus.csqworld.com',
    username: process.env.CSQ_USERNAME,
    password: process.env.CSQ_PASSWORD,
    terminalId: process.env.CSQ_TERMINAL_ID
};

console.log('Testing CSQ with different amounts...\n');

function generateAuthHeaders() {
    const ST = Math.floor(Date.now() / 1000).toString();
    const pass_sha = crypto.createHash('sha256').update(config.password).digest('hex');
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

async function testAmount(amount) {
    const phone = '5527642763';
    const localRef = String(Date.now()).slice(-8);

    const payload = {
        "localDateTime": new Date().toISOString().slice(0, 19),
        "account": phone,
        "amountToSendX100": amount * 100
    };

    const url = `${config.baseUrl}/pre-paid/recharge/purchase/${config.terminalId}/1/${localRef}`;

    try {
        console.log(`\nTesting ${amount} MXN (${amount * 100} cents)...`);

        const response = await axios({
            method: 'POST',
            url: url,
            headers: generateAuthHeaders(),
            data: payload,
            timeout: 60000
        });

        console.log('✅ Response:', JSON.stringify(response.data, null, 2));
        return response.data;

    } catch (error) {
        if (error.response) {
            console.log('❌ Error:', error.response.status, JSON.stringify(error.response.data, null, 2));
        } else {
            console.log('❌ Error:', error.message);
        }
    }
}

async function run() {
    const amounts = [10, 20, 30, 50, 100]; // Common Mexican topup amounts

    console.log('='.repeat(80));
    console.log('Testing different amounts with Operator 1');
    console.log('='.repeat(80));

    for (const amount of amounts) {
        await testAmount(amount);
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second between tests
    }

    console.log('\n' + '='.repeat(80));
    console.log('Tests complete\n');
}

run().catch(console.error);
