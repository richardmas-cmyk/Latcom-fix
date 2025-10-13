/**
 * Payments Mexico Provider Test Script
 * Tests the Payments Mexico (Telefonica) integration
 */

require('dotenv').config({ path: '.env.staging' });
const PaymentsMexicoProvider = require('./providers/payments-mexico-provider');

async function testPaymentsMexico() {
    console.log('\n🧪 Testing Payments Mexico Provider Integration\n');
    console.log('='.repeat(60));

    const provider = new PaymentsMexicoProvider();

    // Test 1: Check if provider is configured
    console.log('\n📋 Test 1: Provider Configuration');
    console.log('Provider ready:', provider.isReady());
    console.log('Capabilities:', JSON.stringify(provider.getCapabilities(), null, 2));

    if (!provider.isReady()) {
        console.log('\n⚠️  Provider not configured. Please set environment variables:');
        console.log('   - TELEFONICA_PASSWORD_IVR');
        console.log('   - TELEFONICA_PUNTO_VENTA');
        console.log('\nSkipping further tests.');
        return;
    }

    // Test 2: Ping test (check WSDL accessibility)
    console.log('\n📡 Test 2: WSDL Endpoint Check');
    try {
        const pingResult = await provider.ping();
        console.log('Ping result:', JSON.stringify(pingResult, null, 2));
    } catch (error) {
        console.error('Ping failed:', error.message);
    }

    // Test 3: Test topup (with test phone number)
    console.log('\n💰 Test 3: Test Topup Transaction');
    console.log('NOTE: This will attempt a real transaction if credentials are valid!');
    console.log('Using test phone: 5512345678');
    console.log('Amount: 20 MXN');

    const testTransaction = {
        phone: '5512345678',
        amount: 20,
        transactionType: '00', // Traditional recharge
        country: 'MX'
    };

    try {
        const result = await provider.topup(testTransaction);
        console.log('\nTopup result:', JSON.stringify(result, null, 2));

        if (result.success) {
            console.log('✅ Transaction successful!');
            console.log('Provider Transaction ID:', result.providerTransactionId);
            console.log('Response Time:', result.responseTime + 'ms');
        } else {
            console.log('❌ Transaction failed:', result.message);
        }
    } catch (error) {
        console.error('❌ Topup error:', error.message);
    }

    console.log('\n' + '='.repeat(60));
    console.log('🏁 Tests Complete\n');
}

// Run tests
testPaymentsMexico().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
