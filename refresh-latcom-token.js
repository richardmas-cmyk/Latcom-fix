#!/usr/bin/env node
/**
 * Refresh Latcom Authentication Token
 * This will force a new login to Latcom and test the credentials
 */

const axios = require('axios');

async function refreshLatcomToken() {
    console.log('🔐 Refreshing Latcom authentication token...\n');

    const config = {
        baseUrl: process.env.LATCOM_DIST_API || 'https://lattest.mitopup.com',
        username: process.env.LATCOM_USERNAME || 'enviadespensa',
        password: process.env.LATCOM_PASSWORD || 'ENV!d32025#',
        userUid: process.env.LATCOM_USER_UID || '20060916',
        distApi: process.env.LATCOM_API_KEY || '38aa13413d1431fba1824f2633c2b7d67f5fffcb91b043629a0d1fe09df2fb8d'
    };

    console.log('Configuration:');
    console.log('==============');
    console.log('Base URL:', config.baseUrl);
    console.log('Username:', config.username);
    console.log('User UID:', config.userUid);
    console.log('API Key:', config.distApi.substring(0, 20) + '...');
    console.log('');

    try {
        console.log('📡 Sending login request to Latcom...');

        const response = await axios.post(
            `${config.baseUrl}/api/dislogin`,
            {
                username: config.username,
                password: config.password,
                dist_api: config.distApi,
                user_uid: config.userUid
            },
            {
                headers: { 'Content-Type': 'application/json' },
                timeout: 30000
            }
        );

        console.log('');
        console.log('Response Status:', response.status);
        console.log('Response Data:', JSON.stringify(response.data, null, 2));
        console.log('');

        if (response.data && response.data.access) {
            console.log('✅ SUCCESS! Latcom authentication token obtained\n');
            console.log('Access Token:', response.data.access.substring(0, 50) + '...');
            console.log('Token will expire in 4 minutes');
            console.log('');
            console.log('🎉 Latcom is ready to process topups!');
            return response.data.access;
        } else {
            console.error('❌ FAILED: No access token in response');
            console.error('Response:', response.data);
            return null;
        }

    } catch (error) {
        console.error('\n❌ Latcom login error:', error.message);

        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Response:', JSON.stringify(error.response.data, null, 2));
        } else if (error.request) {
            console.error('No response received from server');
            console.error('Check if Latcom API is accessible:', config.baseUrl);
        } else {
            console.error('Request setup error:', error.message);
        }

        return null;
    }
}

// Run the function
refreshLatcomToken().then(token => {
    if (token) {
        console.log('\n✅ Token refresh successful');
        process.exit(0);
    } else {
        console.log('\n❌ Token refresh failed');
        process.exit(1);
    }
});
