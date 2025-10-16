#!/usr/bin/env node
/**
 * Comprehensive Latcom Platform Check
 * Testing all aspects of Latcom integration
 */

const axios = require('axios');
const dns = require('dns').promises;

async function comprehensiveLatcomCheck() {
    console.log('='.repeat(80));
    console.log('COMPREHENSIVE LATCOM PLATFORM CHECK');
    console.log('='.repeat(80));
    console.log('Date:', new Date().toISOString());
    console.log('');

    const config = {
        baseUrl: process.env.LATCOM_DIST_API || 'https://lattest.mitopup.com',
        username: process.env.LATCOM_USERNAME || 'enviadespensa',
        password: process.env.LATCOM_PASSWORD || 'ENV!d32025#',
        userUid: process.env.LATCOM_USER_UID || '20060916',
        distApi: process.env.LATCOM_API_KEY || '38aa13413d1431fba1824f2633c2b7d67f5fffcb91b043629a0d1fe09df2fb8d'
    };

    // Test 1: DNS Resolution
    console.log('📡 TEST 1: DNS Resolution');
    console.log('-'.repeat(80));
    try {
        const hostname = config.baseUrl.replace('https://', '').replace('http://', '');
        const addresses = await dns.resolve4(hostname);
        console.log(`✅ DNS resolves: ${hostname} → ${addresses.join(', ')}`);
    } catch (error) {
        console.log(`❌ DNS failed: ${error.message}`);
    }
    console.log('');

    // Test 2: Network Connectivity
    console.log('🌐 TEST 2: Network Connectivity');
    console.log('-'.repeat(80));
    try {
        const response = await axios.get(config.baseUrl, { timeout: 5000 });
        console.log(`✅ Server reachable: ${response.status} ${response.statusText}`);
        if (response.headers.server) {
            console.log(`   Server: ${response.headers.server}`);
        }
    } catch (error) {
        if (error.response) {
            console.log(`✅ Server reachable: ${error.response.status} (expected - no route at /)`);
        } else {
            console.log(`❌ Cannot reach server: ${error.message}`);
        }
    }
    console.log('');

    // Test 3: Check Our IP
    console.log('🔍 TEST 3: Our Outbound IP');
    console.log('-'.repeat(80));
    try {
        const ipResponse = await axios.get('https://api.ipify.org?format=json', { timeout: 5000 });
        console.log(`✅ Our IP: ${ipResponse.data.ip}`);
        console.log(`   Expected: 162.220.234.15 (Railway production)`);
        if (ipResponse.data.ip !== '162.220.234.15') {
            console.log(`   ⚠️  IP MISMATCH!`);
        }
    } catch (error) {
        console.log(`❌ Cannot determine IP: ${error.message}`);
    }
    console.log('');

    // Test 4: Latcom Authentication Attempt
    console.log('🔐 TEST 4: Latcom Authentication');
    console.log('-'.repeat(80));
    console.log(`URL: ${config.baseUrl}/api/dislogin`);
    console.log(`Username: ${config.username}`);
    console.log(`User UID: ${config.userUid}`);
    console.log('');

    try {
        const requestBody = {
            username: config.username,
            password: config.password,
            dist_api: config.distApi,
            user_uid: config.userUid
        };

        console.log('Request Body:');
        console.log(JSON.stringify({
            username: requestBody.username,
            password: '***HIDDEN***',
            dist_api: requestBody.dist_api.substring(0, 20) + '...',
            user_uid: requestBody.user_uid
        }, null, 2));
        console.log('');

        const startTime = Date.now();
        const response = await axios.post(
            `${config.baseUrl}/api/dislogin`,
            requestBody,
            {
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'Latcom-Relier-Hub/1.0'
                },
                timeout: 30000,
                validateStatus: () => true // Accept all status codes
            }
        );
        const responseTime = Date.now() - startTime;

        console.log(`Response Status: ${response.status} ${response.statusText}`);
        console.log(`Response Time: ${responseTime}ms`);
        console.log('Response Headers:');
        console.log(`  Server: ${response.headers.server || 'N/A'}`);
        console.log(`  Content-Type: ${response.headers['content-type'] || 'N/A'}`);
        console.log('');
        console.log('Response Body:');
        console.log(JSON.stringify(response.data, null, 2));
        console.log('');

        if (response.status === 200 && response.data.access) {
            console.log('✅ ✅ ✅ AUTHENTICATION SUCCESSFUL! ✅ ✅ ✅');
            console.log(`   Token: ${response.data.access.substring(0, 50)}...`);
            console.log('');
            console.log('🎉 LATCOM IS WORKING! IP WHITELIST CONFIRMED!');
        } else if (response.status === 400 && response.data.message === 'IP Address not authorized') {
            console.log('❌ AUTHENTICATION FAILED: IP Address not authorized');
            console.log('   IP 162.220.234.15 is NOT whitelisted');
        } else {
            console.log('⚠️  UNEXPECTED RESPONSE');
        }

    } catch (error) {
        console.log('❌ Authentication request failed');
        console.log(`   Error: ${error.message}`);
        if (error.response) {
            console.log(`   Status: ${error.response.status}`);
            console.log(`   Response: ${JSON.stringify(error.response.data, null, 2)}`);
        }
    }
    console.log('');

    // Test 5: Check Environment Variables
    console.log('⚙️  TEST 5: Environment Configuration');
    console.log('-'.repeat(80));
    console.log('Latcom Configuration:');
    console.log(`  LATCOM_DIST_API: ${config.baseUrl}`);
    console.log(`  LATCOM_USERNAME: ${config.username}`);
    console.log(`  LATCOM_USER_UID: ${config.userUid}`);
    console.log(`  LATCOM_API_KEY: ${config.distApi.substring(0, 20)}...`);
    console.log(`  LATCOM_MODE: ${process.env.LATCOM_MODE || 'Not set'}`);
    console.log('');

    // Test 6: Check Recent Code Changes
    console.log('📝 TEST 6: Recent Code Changes');
    console.log('-'.repeat(80));
    try {
        const { execSync } = require('child_process');
        const gitLog = execSync('git log --oneline --since="7 days ago" --grep="latcom" -i', { encoding: 'utf-8' });
        if (gitLog.trim()) {
            console.log('Recent Latcom-related commits:');
            console.log(gitLog);
        } else {
            console.log('✅ No Latcom code changes in last 7 days');
        }
    } catch (error) {
        console.log('Unable to check git history');
    }
    console.log('');

    // Test 7: Check Provider Router Configuration
    console.log('🔀 TEST 7: Provider Router Status');
    console.log('-'.repeat(80));
    try {
        const ProviderRouter = require('./providers/provider-router');
        const router = new ProviderRouter();
        const latcomProvider = router.getProvider('latcom');

        if (latcomProvider) {
            console.log(`Latcom Provider Status: ${latcomProvider.isReady() ? '✅ READY' : '❌ NOT READY'}`);
            const capabilities = latcomProvider.getCapabilities();
            console.log('Capabilities:', JSON.stringify(capabilities, null, 2));
        } else {
            console.log('❌ Latcom provider not found in router');
        }
    } catch (error) {
        console.log(`⚠️  Cannot check provider router: ${error.message}`);
    }
    console.log('');

    console.log('='.repeat(80));
    console.log('CHECK COMPLETE');
    console.log('='.repeat(80));
}

// Run comprehensive check
comprehensiveLatcomCheck().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
