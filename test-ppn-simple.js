const axios = require('axios');
require('dotenv').config();

/**
 * Test script for PPN API endpoints
 */
async function testPPN() {
    const baseUrl = process.env.PPN_BASE_URL || 'https://sandbox.valuetopup.com/api/v2';
    const username = process.env.PPN_USERNAME || 'reliersandbox';
    const password = process.env.PPN_PASSWORD || 'uXOu8W8&bF';

    const credentials = `${username}:${password}`;
    const base64Credentials = Buffer.from(credentials).toString('base64');
    const authHeader = `Basic ${base64Credentials}`;

    console.log('🔍 Testing PPN API Endpoints\n');

    const endpoints = [
        '/products',
        '/products?country=MX',
        '/operators',
        '/balance',
        '/countries',
        '/'
    ];

    for (const endpoint of endpoints) {
        try {
            console.log(`\n📡 Testing: ${baseUrl}${endpoint}`);
            const response = await axios.get(`${baseUrl}${endpoint}`, {
                headers: {
                    'Authorization': authHeader,
                    'Content-Type': 'application/json'
                },
                timeout: 10000
            });

            console.log(`✅ Success (${response.status}):`, JSON.stringify(response.data, null, 2).substring(0, 500));
        } catch (error) {
            console.log(`❌ Failed (${error.response?.status || 'timeout'}):`, error.message);
        }
    }

    // Try a test topup with the Mexico test number
    console.log('\n\n🔥 Testing topup to Mexico test number...');
    try {
        const topupResponse = await axios.post(
            `${baseUrl}/topup`,
            {
                mobile: '522345678901',
                amount: 10
            },
            {
                headers: {
                    'Authorization': authHeader,
                    'Content-Type': 'application/json'
                },
                timeout: 30000
            }
        );

        console.log('✅ Topup Response:', JSON.stringify(topupResponse.data, null, 2));
    } catch (error) {
        console.log(`❌ Topup Failed:`, error.message);
        if (error.response) {
            console.log('Response:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

testPPN();
