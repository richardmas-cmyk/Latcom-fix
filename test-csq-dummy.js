/**
 * Test CSQ with DummyTopup SKU
 * SKU 9990 - DummyTopup for testing
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

console.log('Testing CSQ with DummyTopup (SKU 9990)...\n');

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

async function testDummyTopup() {
    const phone = '5527642763';
    const localRef = String(Date.now()).slice(-8);

    // Using DummyTopup SKU 9990
    // Available: From 100 to 1000 cents (1 to 10 USD)
    const payload = {
        "localDateTime": new Date().toISOString().slice(0, 19),
        "account": phone,
        "amountToSendX100": 500  // 5 USD / 500 cents
    };

    const url = `${config.baseUrl}/pre-paid/recharge/purchase/${config.terminalId}/9990/${localRef}`;

    try {
        console.log('Request:');
        console.log('  SKU: 9990 (DummyTopup)');
        console.log('  Phone:', phone);
        console.log('  Amount: 5 USD (500 cents)');
        console.log('  Reference:', localRef);
        console.log('');

        const response = await axios({
            method: 'POST',
            url: url,
            headers: generateAuthHeaders(),
            data: payload,
            timeout: 60000
        });

        console.log('✅ Response:');
        console.log(JSON.stringify(response.data, null, 2));

        const result = response.data?.items?.[0];
        if (result && (result.resultcode === 10 || result.resultcode === '10')) {
            console.log('\n🎉 SUCCESS! Transaction completed!');
            console.log('Provider TX ID:', result.supplierreference || result.suppliertoken);
        } else {
            console.log('\n⚠️  Transaction returned error code:', result?.resultcode);
        }

    } catch (error) {
        if (error.response) {
            console.log('❌ Error:', error.response.status);
            console.log(JSON.stringify(error.response.data, null, 2));
        } else {
            console.log('❌ Error:', error.message);
        }
    }
}

testDummyTopup().catch(console.error);
