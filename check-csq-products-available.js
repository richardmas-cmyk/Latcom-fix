/**
 * Check CSQ Available Products
 * Using the endpoint Adriana provided
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

console.log('Checking available products for terminal:', config.terminalId);
console.log('Username:', config.username);
console.log('');

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

async function checkProducts() {
    // Adriana's endpoint: {{url}}/article/view-set/saleconditions/customer-config/{{terminalid}}/0
    const endpoint = `/article/view-set/saleconditions/customer-config/${config.terminalId}/0`;
    const url = `${config.baseUrl}${endpoint}`;

    console.log('Querying:', endpoint);
    console.log('');

    try {
        const response = await axios({
            method: 'GET',
            url: url,
            headers: generateAuthHeaders(),
            timeout: 60000
        });

        console.log('✅ SUCCESS! Available Products:');
        console.log('='.repeat(80));
        console.log(JSON.stringify(response.data, null, 2));
        console.log('='.repeat(80));

        // Try to parse and display in a more readable format
        if (response.data && response.data.items) {
            console.log('\n📦 Product Summary:');
            response.data.items.forEach((item, index) => {
                console.log(`\n${index + 1}. Product ID: ${item.id || item.articleId || 'N/A'}`);
                console.log(`   Name: ${item.name || item.description || 'N/A'}`);
                console.log(`   Operator: ${item.operator || item.operatorId || 'N/A'}`);
                console.log(`   Price: ${item.price || item.amount || 'N/A'}`);
            });
        }

    } catch (error) {
        if (error.response) {
            console.log('❌ Error:', error.response.status);
            console.log('Response:', JSON.stringify(error.response.data, null, 2));
        } else {
            console.log('❌ Error:', error.message);
        }
    }
}

checkProducts().catch(console.error);
