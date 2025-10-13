/**
 * Direct Latcom API Test - Bypass provider class
 * Tests authentication directly to isolate the issue
 */

const axios = require('axios');

async function testDirectLatcom() {
    console.log('\n🔧 Direct Latcom API Test\n');
    console.log('='.repeat(60));

    // Get credentials from environment
    const baseUrl = process.env.LATCOM_DIST_API;
    const username = process.env.LATCOM_USERNAME;
    const password = process.env.LATCOM_PASSWORD;
    const distApi = process.env.LATCOM_API_KEY;
    const userUid = process.env.LATCOM_USER_UID;

    console.log('\n📋 Testing Configuration:');
    console.log('Base URL:', baseUrl);
    console.log('Username:', username);
    console.log('User UID:', userUid);
    console.log('API Key (first 10):', distApi?.substring(0, 10) + '...');

    // Step 1: Check IP
    console.log('\n🌐 Step 1: Checking our IP address...');
    try {
        const ipResponse = await axios.get('https://api.ipify.org?format=json');
        console.log('Our IP:', ipResponse.data.ip);
    } catch (e) {
        console.log('Could not fetch IP:', e.message);
    }

    // Step 2: Try login with different approaches
    console.log('\n🔐 Step 2: Testing Login...');

    // Attempt 1: Standard login
    console.log('\n   Attempt 1: Standard POST to /api/dislogin');
    try {
        const loginResponse = await axios.post(
            `${baseUrl}/api/dislogin`,
            {
                username: username,
                password: password,
                dist_api: distApi,
                user_uid: userUid
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'User-Agent': 'Relier-Hub/1.0'
                },
                timeout: 30000,
                validateStatus: () => true // Don't throw on any status
            }
        );

        console.log('   Status:', loginResponse.status);
        console.log('   Response:', JSON.stringify(loginResponse.data, null, 2));

        if (loginResponse.status === 200 && loginResponse.data.access) {
            const token = loginResponse.data.access;
            console.log('\n✅ LOGIN SUCCESSFUL!');
            console.log('Token (first 30 chars):', token.substring(0, 30) + '...');

            // Step 3: Try a transaction with this token
            console.log('\n💰 Step 3: Testing Transaction with Valid Token...');
            await testTransactionWithToken(baseUrl, token);

        } else {
            console.log('\n❌ LOGIN FAILED');
            console.log('Status:', loginResponse.status);
            console.log('Error:', JSON.stringify(loginResponse.data, null, 2));
        }

    } catch (error) {
        console.log('   ❌ Error:', error.message);
        if (error.response) {
            console.log('   Status:', error.response.status);
            console.log('   Response:', JSON.stringify(error.response.data, null, 2));
        }
    }

    // Attempt 2: Try with different headers
    console.log('\n   Attempt 2: With additional headers');
    try {
        const loginResponse = await axios.post(
            `${baseUrl}/api/dislogin`,
            {
                username: username,
                password: password,
                dist_api: distApi,
                user_uid: userUid
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'X-Forwarded-For': '38.64.20.153',
                    'User-Agent': 'Mozilla/5.0'
                },
                timeout: 30000,
                validateStatus: () => true
            }
        );

        console.log('   Status:', loginResponse.status);
        if (loginResponse.status === 200) {
            console.log('   ✅ This approach worked!');
            console.log('   Token:', loginResponse.data.access?.substring(0, 30) + '...');
        } else {
            console.log('   ❌ Still failed:', loginResponse.data.message);
        }

    } catch (error) {
        console.log('   ❌ Error:', error.message);
    }

    // Attempt 3: Test if API is reachable at all
    console.log('\n   Attempt 3: Testing API connectivity');
    try {
        const pingResponse = await axios.get(`${baseUrl}/health`, {
            timeout: 10000,
            validateStatus: () => true
        });
        console.log('   Health endpoint status:', pingResponse.status);
    } catch (error) {
        console.log('   No health endpoint or not reachable');
    }

    console.log('\n' + '='.repeat(60));
}

async function testTransactionWithToken(baseUrl, token) {
    const transactionBody = {
        targetMSISDN: "5566374683",
        dist_transid: "TEST_" + Date.now(),
        operator: "TELEFONICA",
        country: "MEXICO",
        currency: "USD",
        amount: 20,
        productId: "XOOM_20_MXN",
        skuID: "0",
        service: 2
    };

    console.log('Transaction request:', JSON.stringify(transactionBody, null, 2));

    try {
        const txResponse = await axios.post(
            `${baseUrl}/api/tn/fast`,
            transactionBody,
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/json'
                },
                timeout: 60000,
                validateStatus: () => true
            }
        );

        console.log('\nTransaction Status:', txResponse.status);
        console.log('Transaction Response:', JSON.stringify(txResponse.data, null, 2));

        if (txResponse.data.status === 'Success' || txResponse.data.status === 'SUCCESS') {
            console.log('\n🎉 TRANSACTION SUCCESSFUL!');
        } else {
            console.log('\n⚠️  Transaction completed but with status:', txResponse.data.status);
        }

    } catch (error) {
        console.log('\n❌ Transaction Error:', error.message);
        if (error.response) {
            console.log('Response:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

// Run test
testDirectLatcom().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
