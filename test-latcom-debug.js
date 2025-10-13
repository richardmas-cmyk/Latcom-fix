/**
 * Latcom Login Debug Script
 * Helps debug authentication issues
 */

require('dotenv').config({ path: '.env.staging' });
const axios = require('axios');

async function debugLatcomLogin() {
    console.log('\n🔍 Debugging Latcom Login\n');
    console.log('='.repeat(60));

    // Get environment variables
    const baseUrl = process.env.LATCOM_DIST_API;
    const username = process.env.LATCOM_USERNAME;
    const password = process.env.LATCOM_PASSWORD;
    const distApi = process.env.LATCOM_API_KEY;
    const userUid = process.env.LATCOM_USER_UID;

    console.log('\n📋 Configuration:');
    console.log('Base URL:', baseUrl);
    console.log('Username:', username ? username.substring(0, 4) + '***' : 'NOT SET');
    console.log('Password:', password ? '***' + password.substring(password.length - 3) : 'NOT SET');
    console.log('Dist API:', distApi ? distApi.substring(0, 10) + '***' : 'NOT SET');
    console.log('User UID:', userUid);

    if (!baseUrl || !username || !password || !distApi) {
        console.log('\n❌ Missing required configuration!');
        return;
    }

    // Attempt login
    console.log('\n🔐 Attempting Login...');
    const loginUrl = `${baseUrl}/api/dislogin`;
    console.log('Login URL:', loginUrl);

    const requestBody = {
        username: username,
        password: password,
        dist_api: distApi,
        user_uid: userUid
    };

    console.log('\n📤 Request Body:');
    console.log(JSON.stringify({
        username: username,
        password: '***',
        dist_api: distApi.substring(0, 10) + '***',
        user_uid: userUid
    }, null, 2));

    try {
        const response = await axios.post(
            loginUrl,
            requestBody,
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                timeout: 30000
            }
        );

        console.log('\n✅ Login Successful!');
        console.log('Status Code:', response.status);
        console.log('\n📥 Response:');
        console.log(JSON.stringify(response.data, null, 2));

        if (response.data && response.data.access) {
            console.log('\n🎫 Access Token:', response.data.access.substring(0, 20) + '...');
        }

    } catch (error) {
        console.log('\n❌ Login Failed!');

        if (error.response) {
            console.log('Status Code:', error.response.status);
            console.log('Status Text:', error.response.statusText);
            console.log('\n📥 Error Response:');
            console.log(JSON.stringify(error.response.data, null, 2));
            console.log('\n🔍 Response Headers:');
            console.log(JSON.stringify(error.response.headers, null, 2));
        } else if (error.request) {
            console.log('No response received from server');
            console.log('Error:', error.message);
        } else {
            console.log('Error:', error.message);
        }
    }

    console.log('\n' + '='.repeat(60));
    console.log('🏁 Debug Complete\n');
}

// Run debug
debugLatcomLogin().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
