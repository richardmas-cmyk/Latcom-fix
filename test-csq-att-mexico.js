/**
 * Test CSQ AT&T Mexico Product
 * Tests real AT&T Mexico topup with actual Mexican phone numbers
 *
 * AT&T Mexico (SKU 7952) behavior:
 * - Available denominations: 500, 1000, 1500, 2000, 3000, 5000 cents ($5-$50 USD)
 * - Requires real Mexican AT&T phone numbers (044/045 prefix)
 * - This is a REAL product, not a test product like DummyTopup
 *
 * Reference: https://evsbus.csqworld.com/article/view-set/saleconditions/customer-config/173103/0
 */

require('dotenv').config({ path: '.env.staging' });
const CSQProvider = require('./providers/csq-provider');

async function testATTMexico() {
    console.log('🧪 Testing CSQ AT&T Mexico Product\n');
    console.log('='.repeat(80));

    const csq = new CSQProvider();

    // Test 1: Get products
    console.log('\n📦 Test 1: Fetching available products...\n');
    const products = await csq.getProducts();
    console.log(`✅ Found ${products.length} products`);

    // Find AT&T Mexico product
    const attProduct = products.find(p => p.operator === 'AT&T Mexico' || p.skuId === 7952);
    if (attProduct) {
        console.log('\n✅ AT&T Mexico product found:');
        console.log('   SKU ID:', attProduct.skuId);
        console.log('   Operator:', attProduct.operator);
        console.log('   Country:', attProduct.country);
        console.log('   Denominations:', attProduct.denominations);
        console.log('   MSISDN Mask:', attProduct.msisdnMask);
        console.log('   Exchange Rate:', attProduct.exchangeRate);
        console.log('   Exchange Units:', attProduct.exchangeUnits);
    } else {
        console.log('❌ AT&T Mexico product (SKU 7952) not found in product list');
        console.log('\nAvailable products:');
        products.forEach(p => {
            console.log(`   - ${p.operator} (SKU ${p.skuId}) - ${p.country}`);
        });
        return;
    }

    console.log('\n' + '='.repeat(80));

    // Test 2: AT&T Mexico topup with test account
    console.log('\n📱 Test 2: Testing AT&T Mexico topup\n');
    console.log('⚠️  IMPORTANT: This is a REAL product, not a test product.');
    console.log('   We will use a test account ending in "000" to simulate success.\n');

    const testAccount = '5566374000'; // Test account ending in 000 for simulation
    const testAmount = 5; // $5 USD (minimum denomination)

    console.log(`Test Account: ${testAccount}`);
    console.log(`Amount: $${testAmount} USD (${testAmount * 100} cents)`);
    console.log('SKU ID: 7952 (AT&T Mexico)');
    console.log('-'.repeat(60));

    try {
        const result = await csq.topup({
            phone: testAccount,
            amount: testAmount,
            skuId: '7952', // AT&T Mexico
            country: 'MX'
        });

        console.log('\nResponse:', result.success ? '✅ SUCCESS' : '❌ FAILED');
        console.log('Provider:', result.provider);
        console.log('Response Code:', result.responseCode);
        console.log('Message:', result.message);
        console.log('Response Time:', result.responseTime + 'ms');

        if (result.providerTransactionId) {
            console.log('Transaction ID:', result.providerTransactionId);
        }

        if (result.success) {
            console.log('\n✅ AT&T Mexico topup successful!');
            console.log('   This validates that our CSQ integration can process real Mexican topups.');
        } else {
            console.log('\n⚠️  Topup failed with code', result.responseCode);
            console.log('   This may be expected if the test account is not valid.');
            console.log('   For production, use real Mexican AT&T phone numbers.');
        }

    } catch (error) {
        console.log('❌ Error:', error.message);
        console.log('\nThis error may occur because:');
        console.log('1. Test account is not a valid AT&T Mexico number');
        console.log('2. Product requires real Mexican phone numbers');
        console.log('3. Additional validation is needed for real products');
    }

    console.log('\n' + '='.repeat(80));

    // Test 3: Parameters endpoint for AT&T Mexico
    console.log('\n🔍 Test 3: Checking parameters for AT&T Mexico\n');

    try {
        const axios = require('axios');
        const crypto = require('crypto');

        const timestamp = Math.floor(Date.now() / 1000).toString();
        const password = process.env.CSQ_PASSWORD;
        const passwordHash = crypto.createHash('sha256').update(password).digest('hex');
        const timestampHash = crypto.createHash('sha256').update(timestamp).digest('hex');
        const authHash = crypto.createHash('sha256').update(passwordHash + timestampHash).digest('hex');

        const response = await axios.get(
            `https://evsbus.csqworld.com/pre-paid/recharge/parameters/${process.env.CSQ_TERMINAL_ID}/7952`,
            {
                headers: {
                    'U': process.env.CSQ_USERNAME,
                    'ST': timestamp,
                    'SH': authHash,
                    'Accept': 'application/json',
                    'Accept-Encoding': 'gzip',
                    'Content-Type': 'application/json',
                    'X-Real-Ip': '0.0.0.0',
                    'Cache-Hash': '0',
                    'Agent': 'Relier-Hub/1.0'
                },
                timeout: 30000
            }
        );

        console.log('Parameters response:', JSON.stringify(response.data, null, 2));
        console.log('\n✅ Parameters endpoint working for AT&T Mexico');

    } catch (error) {
        console.log('❌ Parameters error:', error.response?.data || error.message);
    }

    console.log('\n' + '='.repeat(80));
    console.log('\n✅ Tests completed\n');

    console.log('📋 Summary:');
    console.log('   - Product catalog: Working ✅');
    console.log('   - AT&T Mexico product: Found ✅');
    console.log('   - Parameters endpoint: Check results above');
    console.log('   - Topup endpoint: Check results above');
    console.log('\n💡 Next steps:');
    console.log('   1. Validate with real Mexican AT&T phone numbers in production');
    console.log('   2. Test different denominations ($5, $10, $15, $20, $30, $50)');
    console.log('   3. Monitor transaction success rates');
    console.log('   4. Implement proper error handling for production use');
}

// Run tests
testATTMexico().catch(error => {
    console.error('❌ Test error:', error);
    process.exit(1);
});
