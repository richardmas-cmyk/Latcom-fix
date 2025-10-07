const axios = require('axios');
require('dotenv').config();

/**
 * Test script to fetch available PPN SKUs for Mexico
 */
async function testPPNSKUs() {
    const baseUrl = process.env.PPN_BASE_URL || 'https://sandbox.valuetopup.com/api/v2';
    const username = process.env.PPN_USERNAME || 'reliersandbox';
    const password = process.env.PPN_PASSWORD || 'uXOu8W8&bF';

    // Generate Basic Auth header
    const credentials = `${username}:${password}`;
    const base64Credentials = Buffer.from(credentials).toString('base64');
    const authHeader = `Basic ${base64Credentials}`;

    console.log('🔍 Testing PPN API...\n');
    console.log(`Base URL: ${baseUrl}`);
    console.log(`Username: ${username}`);
    console.log(`Auth Header: ${authHeader}\n`);

    try {
        // Test 1: Get all SKUs
        console.log('📋 Fetching all SKUs...');
        const skusResponse = await axios.get(`${baseUrl}/skus`, {
            headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/json'
            },
            timeout: 10000
        });

        console.log('Response:', JSON.stringify(skusResponse.data, null, 2));

        // Test 2: Get Mexico SKUs if available
        console.log('\n📋 Fetching Mexico SKUs...');
        const mexicoSkusResponse = await axios.get(`${baseUrl}/skus?country=MX`, {
            headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/json'
            },
            timeout: 10000
        });

        console.log('Mexico SKUs:', JSON.stringify(mexicoSkusResponse.data, null, 2));

        // Test 3: Get products
        console.log('\n🎁 Fetching products...');
        const productsResponse = await axios.get(`${baseUrl}/products`, {
            headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/json'
            },
            timeout: 10000
        });

        console.log('Products:', JSON.stringify(productsResponse.data, null, 2));

    } catch (error) {
        console.error('❌ Error:', error.message);
        if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response data:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

testPPNSKUs();
