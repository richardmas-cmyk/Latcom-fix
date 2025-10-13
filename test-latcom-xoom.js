/**
 * Latcom XOOM Test Script
 * Tests a specific XOOM 20 MXN topup transaction
 */

require('dotenv').config({ path: '.env.staging' });
const LatcomProvider = require('./providers/latcom-provider');

async function testLatcomXoom() {
    console.log('\n🧪 Testing Latcom XOOM 20 MXN Transaction\n');
    console.log('='.repeat(60));

    const provider = new LatcomProvider();

    // Test 1: Check if provider is configured
    console.log('\n📋 Test 1: Provider Configuration');
    console.log('Provider ready:', provider.isReady());
    console.log('Capabilities:', JSON.stringify(provider.getCapabilities(), null, 2));

    if (!provider.isReady()) {
        console.log('\n⚠️  Provider not configured. Please set environment variables:');
        console.log('   - LATCOM_DIST_API');
        console.log('   - LATCOM_USERNAME');
        console.log('   - LATCOM_PASSWORD');
        console.log('   - LATCOM_USER_UID');
        console.log('\nSkipping further tests.');
        return;
    }

    // Test 2: Check Latcom Mode
    console.log('\n⚙️  Test 2: Latcom Mode Configuration');
    const latcomMode = process.env.LATCOM_MODE || 'HYBRID';
    console.log('Current LATCOM_MODE:', latcomMode);

    if (latcomMode === 'XOOM_ONLY') {
        console.log('✅ XOOM_ONLY mode - Perfect for this test!');
    } else if (latcomMode === 'HYBRID') {
        console.log('✅ HYBRID mode - Will use XOOM for 20 MXN');
    } else {
        console.log('⚠️  Mode:', latcomMode, '- XOOM product may or may not be used');
    }

    // Test 3: Authenticate with Latcom
    console.log('\n🔐 Test 3: Authentication');
    try {
        const loginSuccess = await provider.login();
        if (loginSuccess) {
            console.log('✅ Authentication successful');
        } else {
            console.log('❌ Authentication failed');
            return;
        }
    } catch (error) {
        console.error('❌ Authentication error:', error.message);
        return;
    }

    // Test 4: Phone number lookup
    console.log('\n📱 Test 4: Phone Number Lookup');
    const phoneNumber = '5566374683';
    try {
        const lookup = await provider.lookupPhone(phoneNumber);
        console.log('Phone lookup result:', JSON.stringify(lookup, null, 2));
    } catch (error) {
        console.error('❌ Phone lookup error:', error.message);
    }

    // Test 5: Execute XOOM 20 MXN topup
    console.log('\n💰 Test 5: XOOM 20 MXN Topup Transaction');
    console.log('⚠️  WARNING: This will execute a REAL transaction!');
    console.log('Phone: ' + phoneNumber);
    console.log('Amount: 20 MXN');
    console.log('Product: XOOM_20_MXN (expected)');

    const testTransaction = {
        phone: phoneNumber,
        amount: 20,
        currency: 'MXN',
        country: 'MEXICO',
        reference: 'TEST_XOOM_' + Date.now()
    };

    console.log('\n🔄 Executing transaction...\n');

    try {
        const result = await provider.topup(testTransaction);

        console.log('\n' + '='.repeat(60));
        console.log('TRANSACTION RESULT');
        console.log('='.repeat(60));
        console.log(JSON.stringify(result, null, 2));
        console.log('='.repeat(60));

        if (result.success) {
            console.log('\n✅ Transaction SUCCESSFUL!');
            console.log('   Provider Transaction ID:', result.providerTransactionId);
            console.log('   Message:', result.message);
            console.log('   Response Time:', result.responseTime + 'ms');

            if (result.rawResponse) {
                console.log('\n📄 Raw Response Details:');
                console.log('   Status:', result.rawResponse.status);
                console.log('   Trans ID:', result.rawResponse.transId);
                console.log('   Vendor Trans ID:', result.rawResponse.venTransid);
                console.log('   Response Message:', result.rawResponse.responseMessage);
            }
        } else {
            console.log('\n❌ Transaction FAILED');
            console.log('   Message:', result.message);
            console.log('   Response Time:', result.responseTime + 'ms');

            if (result.rawResponse) {
                console.log('\n📄 Error Details:');
                console.log(JSON.stringify(result.rawResponse, null, 2));
            }
        }

    } catch (error) {
        console.error('\n❌ Transaction Error:', error.message);
        if (error.response) {
            console.error('API Response:', JSON.stringify(error.response.data, null, 2));
        }
    }

    console.log('\n' + '='.repeat(60));
    console.log('🏁 Test Complete\n');
}

// Run test
testLatcomXoom().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
