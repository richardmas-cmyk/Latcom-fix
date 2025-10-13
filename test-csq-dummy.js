/**
 * Test CSQ DummyTopup Product
 * Tests different account endings to verify error code handling
 *
 * DummyTopup (SKU 9990) behavior:
 * - Last 2 digits of account determine the result code (rc)
 * - Example: account ending in "10" returns rc=10 (success)
 * - Example: account ending in "13" returns rc=13 (insufficient balance)
 *
 * Reference: https://csq-docs.apidog.io/doc-1259308
 */

require('dotenv').config({ path: '.env.staging' });
const CSQProvider = require('./providers/csq-provider');

async function testDummyTopup() {
    console.log('🧪 Testing CSQ DummyTopup Product\n');
    console.log('=' .repeat(80));

    const csq = new CSQProvider();

    // Test 1: Get products
    console.log('\n📦 Test 1: Fetching available products...\n');
    const products = await csq.getProducts();
    console.log(`✅ Found ${products.length} products`);

    // Find DummyTopup
    const dummyProduct = products.find(p => p.skuId === 9990);
    if (dummyProduct) {
        console.log('\n✅ DummyTopup product found:');
        console.log('   SKU ID:', dummyProduct.skuId);
        console.log('   Operator:', dummyProduct.operator);
        console.log('   Country:', dummyProduct.country);
        console.log('   Denominations:', dummyProduct.denominations);
    } else {
        console.log('❌ DummyTopup product (SKU 9990) not found in product list');
        return;
    }

    // Find Mexico AT&T product
    const attProduct = products.find(p => p.operator === 'AT&T Mexico');
    if (attProduct) {
        console.log('\n✅ AT&T Mexico product found:');
        console.log('   SKU ID:', attProduct.skuId);
        console.log('   Operator:', attProduct.operator);
        console.log('   Denominations:', attProduct.denominations);
    }

    console.log('\n' + '='.repeat(80));

    // Test 2: DummyTopup with different account endings
    console.log('\n📱 Test 2: Testing DummyTopup with different account endings\n');
    console.log('⚠️  IMPORTANT: DummyTopup uses LAST 3 DIGITS to determine result:');
    console.log('   - Ending in 000 → Success (rc=0)');
    console.log('   - Ending in 001 → Error 971');
    console.log('   - Ending in 002 → Error 990');
    console.log('   - Any other → Error 991 (default)\n');

    const testCases = [
        { account: '5566374000', expectedRc: 0, expectedResult: 'SUCCESS', description: 'Success case (ends in 000)' },
        { account: '5566374001', expectedRc: 971, expectedResult: 'FAIL', description: 'Error 971 (ends in 001)' },
        { account: '5566374002', expectedRc: 990, expectedResult: 'FAIL', description: 'Error 990 (ends in 002)' },
        { account: '5566374999', expectedRc: 991, expectedResult: 'FAIL', description: 'Default error (ends in 999)' }
    ];

    for (const testCase of testCases) {
        console.log(`\nTest Case: ${testCase.description}`);
        console.log(`Account: ${testCase.account} (ends in ${testCase.account.slice(-3)})`);
        console.log(`Expected RC: ${testCase.expectedRc}`);
        console.log(`Expected Result: ${testCase.expectedResult}`);
        console.log('-'.repeat(60));

        try {
            const result = await csq.topup({
                phone: testCase.account,
                amount: 5, // $5 USD (500 cents)
                skuId: '9990', // DummyTopup
                country: 'US'
            });

            console.log('Response:', result.success ? '✅ SUCCESS' : '❌ FAILED');
            console.log('Provider:', result.provider);
            console.log('Response Code:', result.responseCode);
            console.log('Message:', result.message);
            console.log('Response Time:', result.responseTime + 'ms');

            if (result.providerTransactionId) {
                console.log('Transaction ID:', result.providerTransactionId);
            }

            // Verify expected result
            if (result.responseCode == testCase.expectedRc) {
                console.log('✅ Result code matches expected');
            } else {
                console.log(`⚠️  Result code mismatch: got ${result.responseCode}, expected ${testCase.expectedRc}`);
            }

        } catch (error) {
            console.log('❌ Error:', error.message);
        }

        // Wait between requests
        await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log('\n' + '='.repeat(80));
    console.log('\n✅ Tests completed\n');
}

// Run tests
testDummyTopup().catch(error => {
    console.error('❌ Test error:', error);
    process.exit(1);
});
