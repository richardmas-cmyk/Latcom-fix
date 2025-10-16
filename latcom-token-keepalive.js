#!/usr/bin/env node
/**
 * Latcom Token Keep-Alive Service
 * Continuously refreshes Latcom token every 3 minutes (before 4-minute expiration)
 * This ensures we always have a valid token for topup requests
 */

const axios = require('axios');

const config = {
    baseUrl: process.env.LATCOM_DIST_API || 'https://lattest.mitopup.com',
    username: process.env.LATCOM_USERNAME || 'enviadespensa',
    password: process.env.LATCOM_PASSWORD || 'ENV!d32025#',
    userUid: process.env.LATCOM_USER_UID || '20060916',
    distApi: process.env.LATCOM_API_KEY || '38aa13413d1431fba1824f2633c2b7d67f5fffcb91b043629a0d1fe09df2fb8d'
};

let currentToken = null;
let tokenExpiryTime = null;
let refreshInterval = 3 * 60 * 1000; // 3 minutes in milliseconds
let consecutiveFailures = 0;
const MAX_FAILURES = 5;

async function refreshToken() {
    try {
        console.log(`[${new Date().toISOString()}] 🔄 Refreshing Latcom token...`);

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

        if (response.data && response.data.access) {
            currentToken = response.data.access;
            tokenExpiryTime = Date.now() + (4 * 60 * 1000); // 4 minutes from now
            consecutiveFailures = 0;

            console.log(`[${new Date().toISOString()}] ✅ Token refreshed successfully`);
            console.log(`   Token: ${currentToken.substring(0, 50)}...`);
            console.log(`   Expires: ${new Date(tokenExpiryTime).toISOString()}`);
            console.log(`   Next refresh in: 3 minutes`);

            // Store token in global variable for provider to use
            global.latcomToken = currentToken;
            global.latcomTokenExpiry = tokenExpiryTime;

            return true;
        } else {
            throw new Error('No access token in response');
        }

    } catch (error) {
        consecutiveFailures++;

        console.error(`[${new Date().toISOString()}] ❌ Token refresh failed (${consecutiveFailures}/${MAX_FAILURES})`);

        if (error.response) {
            console.error(`   Status: ${error.response.status}`);
            console.error(`   Error: ${JSON.stringify(error.response.data)}`);

            // If IP not authorized, log clearly
            if (error.response.data && error.response.data.message === 'IP Address not authorized') {
                console.error('');
                console.error('   ⚠️  IP WHITELIST ISSUE:');
                console.error('   Your server IP is not whitelisted by Latcom');
                console.error('   Contact Latcom to whitelist your IP address');
                console.error('');
            }
        } else if (error.request) {
            console.error('   No response from Latcom server');
            console.error('   Check network connectivity and Latcom API availability');
        } else {
            console.error('   Error:', error.message);
        }

        // If too many consecutive failures, exit with error
        if (consecutiveFailures >= MAX_FAILURES) {
            console.error('');
            console.error(`[${new Date().toISOString()}] 🛑 Maximum failures reached (${MAX_FAILURES})`);
            console.error('   Keep-alive service shutting down');
            console.error('   Please check Latcom connectivity and credentials');
            process.exit(1);
        }

        return false;
    }
}

async function startKeepAlive() {
    console.log('='.repeat(80));
    console.log('LATCOM TOKEN KEEP-ALIVE SERVICE');
    console.log('='.repeat(80));
    console.log('');
    console.log('Configuration:');
    console.log('  Base URL:', config.baseUrl);
    console.log('  Username:', config.username);
    console.log('  User UID:', config.userUid);
    console.log('  API Key:', config.distApi.substring(0, 20) + '...');
    console.log('  Refresh Interval: 3 minutes');
    console.log('  Token Lifetime: 4 minutes');
    console.log('');
    console.log('='.repeat(80));
    console.log('');

    // Initial token fetch
    const initialSuccess = await refreshToken();

    if (!initialSuccess) {
        console.error('');
        console.error('❌ Failed to get initial token');
        console.error('Will retry in 30 seconds...');
        console.error('');

        // Wait 30 seconds before starting the interval
        await new Promise(resolve => setTimeout(resolve, 30000));
    }

    // Set up periodic refresh every 3 minutes
    setInterval(async () => {
        await refreshToken();
    }, refreshInterval);

    console.log(`[${new Date().toISOString()}] ✅ Keep-alive service started`);
    console.log('   Press Ctrl+C to stop');
    console.log('');
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('');
    console.log(`[${new Date().toISOString()}] 🛑 Keep-alive service stopped by user`);
    console.log('');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('');
    console.log(`[${new Date().toISOString()}] 🛑 Keep-alive service stopped (SIGTERM)`);
    console.log('');
    process.exit(0);
});

// Expose function to get current token
global.getLatcomToken = function() {
    if (!currentToken || Date.now() >= tokenExpiryTime) {
        return null;
    }
    return currentToken;
};

// Start the service
startKeepAlive().catch(error => {
    console.error('Fatal error starting keep-alive service:', error);
    process.exit(1);
});
