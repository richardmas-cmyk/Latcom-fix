const axios = require('axios');
require('dotenv').config();

async function testPPNProducts() {
    const baseUrl = process.env.PPN_BASE_URL || 'https://sandbox.valuetopup.com/api/v2';
    const username = process.env.PPN_USERNAME || 'reliersandbox';
    const password = process.env.PPN_PASSWORD || 'uXOu8W8&bF';

    const credentials = `${username}:${password}`;
    const base64Credentials = Buffer.from(credentials).toString('base64');
    const authHeader = `Basic ${base64Credentials}`;

    console.log('🔍 Testing PPN Products API\n');

    try {
        // Get operators for Mexico
        console.log('📋 Fetching Mexico operators...');
        const operatorsResponse = await axios.get(`${baseUrl}/catalog/operators?countryCode=MX`, {
            headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/json'
            },
            timeout: 10000
        });

        console.log('Operators Response:', JSON.stringify(operatorsResponse.data, null, 2));

        if (operatorsResponse.data.payLoad && operatorsResponse.data.payLoad.length > 0) {
            const firstOperator = operatorsResponse.data.payLoad[0];
            const operatorId = firstOperator.operatorId;

            console.log(`\n📱 Fetching products for operator: ${firstOperator.operatorName} (ID: ${operatorId})`);

            const productsResponse = await axios.get(`${baseUrl}/catalog/getproducts?operatorId=${operatorId}`, {
                headers: {
                    'Authorization': authHeader,
                    'Content-Type': 'application/json'
                },
                timeout: 10000
            });

            console.log('Products Response:', JSON.stringify(productsResponse.data, null, 2));

            // Find RTR (topup) products
            if (productsResponse.data.payLoad) {
                const rtrProducts = productsResponse.data.payLoad.filter(p => p.categoryName === 'Rtr');
                console.log(`\n✅ Found ${rtrProducts.length} RTR products for ${firstOperator.operatorName}`);
                if (rtrProducts.length > 0) {
                    console.log('First RTR Product:', JSON.stringify(rtrProducts[0], null, 2));
                }
            }
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
        if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response data:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

testPPNProducts();
