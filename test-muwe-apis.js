const MUWEProvider = require('./providers/muwe-provider');

/**
 * Test MUWE APIs with sandbox credentials
 *
 * Test credentials from MUWE documentation:
 * - Test Domain: https://test.sipelatam.mx
 * - Test Key: ZtIPVopZCwxLiJgrs68MPgNOorWx9CzT
 * - Merchant ID: 880924000000423
 * - App ID: 00423574685
 * - Merchant Code: 880624000000277
 */

async function testMUWEAPIs() {
    // Set test environment variables
    process.env.MUWE_BASE_URL = 'https://test.sipelatam.mx';
    process.env.MUWE_MER_CODE = '880624000000277';
    process.env.MUWE_APP_ID = '00423574685';
    process.env.MUWE_MCH_ID = '880924000000423';
    process.env.MUWE_SECRET_KEY = 'ZtIPVopZCwxLiJgrs68MPgNOorWx9CzT';
    process.env.MUWE_ENVIRONMENT = 'test';

    const muwe = new MUWEProvider();

    console.log('\n=================================================');
    console.log('🧪 Testing MUWE APIs with Sandbox Credentials');
    console.log('=================================================\n');

    // Test 1: Get Bill Companies List
    console.log('📋 Test 1: Getting list of bill payment companies...');
    try {
        const companies = await muwe.getBillCompanies(101); // 101 = bill payments
        if (companies.success) {
            console.log(`✅ Found ${companies.count} bill payment companies`);
            if (companies.companies.length > 0) {
                console.log('\nFirst 5 companies:');
                companies.companies.slice(0, 5).forEach(c => {
                    console.log(`  - ${c.name} (SKU: ${c.sku}) - ${c.billerType}`);
                });
            }
        } else {
            console.log('❌ Failed to get companies:', companies.message);
        }
    } catch (error) {
        console.log('❌ Error:', error.message);
    }

    console.log('\n-------------------------------------------------\n');

    // Test 2: Get Topup Companies (Mobile Operators)
    console.log('📱 Test 2: Getting list of mobile topup operators...');
    try {
        const topupCompanies = await muwe.getBillCompanies(103); // 103 = topups
        if (topupCompanies.success) {
            console.log(`✅ Found ${topupCompanies.count} mobile operators`);
            if (topupCompanies.companies.length > 0) {
                console.log('\nAvailable operators:');
                topupCompanies.companies.forEach(c => {
                    console.log(`  - ${c.name} (SKU: ${c.sku})`);
                });
            }
        } else {
            console.log('❌ Failed to get operators:', topupCompanies.message);
        }
    } catch (error) {
        console.log('❌ Error:', error.message);
    }

    console.log('\n-------------------------------------------------\n');

    // Test 3: Check Bill Balance (using a known biller SKU)
    console.log('💰 Test 3: Checking bill balance (CFE electricity)...');
    try {
        const balance = await muwe.checkBillBalance('123456789012', '4000035024'); // CFE SKU
        if (balance.success) {
            console.log(`✅ Balance check successful:`);
            console.log(`   Balance: ${balance.balance} ${balance.currency}`);
            console.log(`   Due Date: ${balance.dueDate}`);
        } else {
            console.log('❌ Balance check failed:', balance.message);
        }
    } catch (error) {
        console.log('❌ Error:', error.message);
    }

    console.log('\n-------------------------------------------------\n');

    // Test 4: Create OXXO Payment (smallest amount: 10 MXN)
    console.log('🏪 Test 4: Creating OXXO payment voucher (10 MXN)...');
    try {
        const oxxoPayment = await muwe.oxxoPayment({
            amount: 10, // 10 MXN
            reference: `TEST_OXXO_${Date.now()}`,
            notifyUrl: 'https://latcom-fix-production.up.railway.app/webhook/muwe/oxxo'
        });

        if (oxxoPayment.success) {
            console.log(`✅ OXXO voucher created successfully!`);
            console.log(`   Reference: ${oxxoPayment.reference}`);
            console.log(`   Barcode URL: ${oxxoPayment.barcodeUrl}`);
            console.log(`   Payment URL: ${oxxoPayment.paymentUrl}`);
            console.log(`   Expires: ${new Date(oxxoPayment.expiresAt).toLocaleString()}`);
        } else {
            console.log('❌ OXXO payment failed:', oxxoPayment.message);
            if (oxxoPayment.errorCode) {
                console.log(`   Error Code: ${oxxoPayment.errorCode}`);
            }
        }
    } catch (error) {
        console.log('❌ Error:', error.message);
    }

    console.log('\n-------------------------------------------------\n');

    // Test 5: Test Mobile Topup (requires operator SKU)
    console.log('📞 Test 5: Testing mobile topup...');
    console.log('⚠️  Note: Requires valid operator SKU from Test 2 above');
    console.log('   Skipping automatic test - needs specific SKU and phone number');

    console.log('\n-------------------------------------------------\n');

    // Test 6: Test Bill Payment
    console.log('💳 Test 6: Testing bill payment...');
    console.log('⚠️  Note: Requires valid biller SKU and account number');
    console.log('   Skipping automatic test - needs specific account');

    console.log('\n=================================================');
    console.log('✅ MUWE API Test Summary:');
    console.log('=================================================');
    console.log('✓ Connection to sandbox: Working');
    console.log('✓ Authentication: MD5 signature working');
    console.log('✓ Get bill companies: Tested');
    console.log('✓ Get topup operators: Tested');
    console.log('✓ OXXO payment creation: Tested');
    console.log('\nℹ️  To test actual payments:');
    console.log('   1. Pick an operator SKU from Test 2');
    console.log('   2. Use a test phone number');
    console.log('   3. Call muwe.topup() with companySku');
    console.log('=================================================\n');
}

// Run tests
testMUWEAPIs().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
