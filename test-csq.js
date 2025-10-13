/**
 * CSQ Provider Test Script
 * Tests CSQ with updated development credentials (2025-10-13)
 */

require('dotenv').config({ path: '.env.staging' });
const CSQProvider = require('./providers/csq-provider');

async function testCSQ() {
    console.log('\n🧪 Testing CSQ Provider\n');
    console.log('='.repeat(60));

    const provider = new CSQProvider();

    // Test 1: Check configuration
    console.log('\n📋 Test 1: Provider Configuration');
    console.log('Provider ready:', provider.isReady());
    console.log('Capabilities:', JSON.stringify(provider.getCapabilities(), null, 2));

    if (!provider.isReady()) {
        console.log('\n⚠️  CSQ provider not configured');
        console.log('Required environment variables:');
        console.log('  - CSQ_BASE_URL');
        console.log('  - CSQ_USERNAME');
        console.log('  - CSQ_PASSWORD');
        console.log('  - CSQ_TERMINAL_ID');
        return;
    }

    console.log('\n✅ CSQ configured with credentials:');
    console.log('   Username:', process.env.CSQ_USERNAME);
    console.log('   Terminal:', process.env.CSQ_TERMINAL_ID);
    console.log('   Base URL:', process.env.CSQ_BASE_URL);

    // Test 2: Ping/Health check
    console.log('\n📡 Test 2: Connection Test');
    try {
        const pingResult = await provider.ping();
        console.log('Ping result:', JSON.stringify(pingResult, null, 2));
    } catch (error) {
        console.error('❌ Ping failed:', error.message);
    }

    // Test 3: Check balance
    console.log('\n💰 Test 3: Balance Check');
    try {
        const balanceResult = await provider.checkBalance();
        console.log('Balance result:', JSON.stringify(balanceResult, null, 2));

        if (balanceResult.success) {
            console.log('\n✅ Balance check successful!');
            console.log('   Balance:', balanceResult.balance, balanceResult.currency);
        } else {
            console.log('\n⚠️  Balance check returned:', balanceResult.message);
        }
    } catch (error) {
        console.error('❌ Balance check failed:', error.message);
    }

    // Test 4: Test topup (small amount for testing)
    console.log('\n💳 Test 4: Test Topup Transaction');
    console.log('⚠️  NOTE: This will attempt a REAL transaction!');
    console.log('Phone: 5527642763 (Telcel)');
    console.log('Amount: 20 MXN');
    console.log('SKU: 396 (Telcel)');

    const testTransaction = {
        phone: '5527642763',
        amount: 20,
        skuId: '396', // Telcel
        country: 'MX'
    };

    console.log('\n🔄 Executing transaction...\n');

    try {
        const result = await provider.topup(testTransaction);

        console.log('='.repeat(60));
        console.log('TRANSACTION RESULT');
        console.log('='.repeat(60));
        console.log(JSON.stringify(result, null, 2));
        console.log('='.repeat(60));

        if (result.success) {
            console.log('\n✅ Transaction SUCCESSFUL!');
            console.log('   Provider TX ID:', result.providerTransactionId);
            console.log('   Message:', result.message);
            console.log('   Response Time:', result.responseTime + 'ms');
            console.log('   Response Code:', result.responseCode);
        } else {
            console.log('\n❌ Transaction FAILED');
            console.log('   Message:', result.message);
            console.log('   Response Code:', result.responseCode);
            console.log('   Response Time:', result.responseTime + 'ms');
        }

    } catch (error) {
        console.error('\n❌ Transaction Error:', error.message);
    }

    console.log('\n' + '='.repeat(60));
    console.log('🏁 Tests Complete\n');
}

// Run tests
testCSQ().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
