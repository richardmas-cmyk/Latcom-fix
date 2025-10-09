const CSQProvider = require('./providers/csq-provider');

/**
 * Test CSQ Production Credentials
 *
 * Credentials from email:
 * Usuario: host.180167
 * Contraseña: z5r3rr3s96
 * Terminal: 180167
 */

async function testCSQCredentials() {
    // Set CSQ production credentials
    process.env.CSQ_BASE_URL = 'https://evsbus.csqworld.com'; // Production URL
    process.env.CSQ_USERNAME = 'host.180167';
    process.env.CSQ_PASSWORD = 'z5r3rr3s96';
    process.env.CSQ_TERMINAL_ID = '180167';
    process.env.CSQ_DEFAULT_OPERATOR_ID = '1'; // Mexico operator

    const csq = new CSQProvider();

    console.log('\n╔═══════════════════════════════════════════════════════╗');
    console.log('║  🧪 Testing CSQ Production Credentials              ║');
    console.log('╚═══════════════════════════════════════════════════════╝\n');

    console.log('📋 Credentials:');
    console.log(`   Username: host.180167`);
    console.log(`   Terminal: 180167`);
    console.log(`   Base URL: https://evsbus.csqworld.com`);
    console.log('');

    // Test 1: Ping
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔍 TEST 1: Connection Test (Ping)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    try {
        const pingResult = await csq.ping();
        if (pingResult.success) {
            console.log('✅ PASS: Connection successful!');
            console.log('   Response:', JSON.stringify(pingResult.data, null, 2));
        } else {
            console.log('❌ FAIL: Connection failed');
            console.log('   Error:', pingResult.error);
        }
    } catch (error) {
        console.log('❌ ERROR:', error.message);
    }

    console.log('\n');

    // Test 2: Check Balance
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('💰 TEST 2: Check Account Balance');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    try {
        const balance = await csq.checkBalance();
        if (balance.success) {
            console.log('✅ PASS: Balance retrieved!');
            console.log(`   Balance: ${balance.balance} ${balance.currency}`);
            console.log('   Raw Response:', JSON.stringify(balance.rawResponse, null, 2));
        } else {
            console.log('❌ FAIL: Could not retrieve balance');
            console.log('   Message:', balance.message || balance.error);
        }
    } catch (error) {
        console.log('❌ ERROR:', error.message);
    }

    console.log('\n');

    // Test 3: Test Topup (Small amount for testing)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📞 TEST 3: Mobile Topup Test');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('⚠️  Note: Using test phone number 5512345678');
    console.log('   Amount: 10 MXN (minimum for testing)');
    console.log('');

    try {
        const topupResult = await csq.topup({
            phone: '5512345678',
            amount: 10,
            operatorId: '1', // Mexico operator
            reference: `CSQ_TEST_${Date.now()}`,
            country: 'MX'
        });

        if (topupResult.success) {
            console.log('✅ PASS: Topup successful!');
            console.log(`   Transaction ID: ${topupResult.providerTransactionId}`);
            console.log(`   Message: ${topupResult.message}`);
            console.log(`   Response Time: ${topupResult.responseTime}ms`);
            console.log(`   Response Code: ${topupResult.responseCode}`);
        } else {
            console.log('⚠️  INFO: Topup response received');
            console.log(`   Message: ${topupResult.message}`);
            console.log(`   Response Code: ${topupResult.responseCode}`);
            console.log(`   Response Time: ${topupResult.responseTime}ms`);

            if (topupResult.responseCode === 13) {
                console.log('\n💡 Note: Error 13 = Insufficient balance');
                console.log('   Credentials are working! Just need to fund the account.');
            } else if (topupResult.responseCode === 927) {
                console.log('\n💡 Note: Error 927 = Amount not allowed');
                console.log('   Credentials working! May need different amount or operator.');
            } else if (topupResult.responseCode === 931) {
                console.log('\n💡 Note: Error 931 = Invalid phone format');
                console.log('   Credentials working! Phone number validation issue.');
            }
        }

        console.log('\n📄 Full Response:');
        console.log(JSON.stringify(topupResult.rawResponse, null, 2));

    } catch (error) {
        console.log('❌ ERROR:', error.message);
    }

    console.log('\n');

    // Summary
    console.log('╔═══════════════════════════════════════════════════════╗');
    console.log('║  📊 CSQ CREDENTIALS TEST SUMMARY                     ║');
    console.log('╚═══════════════════════════════════════════════════════╝\n');

    console.log('✅ What We Tested:');
    console.log('   1. Connection to CSQ API');
    console.log('   2. Authentication with credentials');
    console.log('   3. Balance inquiry');
    console.log('   4. Topup transaction flow');
    console.log('');

    console.log('🎯 Next Steps:');
    console.log('   1. If balance is low, fund the CSQ account');
    console.log('   2. Add credentials to Railway environment:');
    console.log('      CSQ_BASE_URL=https://evsbus.csqworld.com');
    console.log('      CSQ_USERNAME=host.180167');
    console.log('      CSQ_PASSWORD=z5r3rr3s96');
    console.log('      CSQ_TERMINAL_ID=180167');
    console.log('   3. Test with real phone numbers');
    console.log('');
}

testCSQCredentials().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
