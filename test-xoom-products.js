/**
 * Test XOOM Products via Latcom
 * Tests: 10, 20, 30, 40, 50, 60, 70, 80, 90, 100 MXN
 */

const axios = require('axios');

const PHONE = '5566374683';
const API_URL = 'https://latcom-fix-production.up.railway.app/api/enviadespensa/topup';
const API_KEY = 'enviadespensa_prod_2025';
const CUSTOMER_ID = 'ENVIADESPENSA_001';

const XOOM_AMOUNTS = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

async function testTopup(amount) {
    try {
        console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`📱 Testing XOOM_${amount}_MXN to ${PHONE}`);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

        const response = await axios.post(API_URL, {
            phone: PHONE,
            amount: amount,
            reference: `XOOM_TEST_${amount}_${Date.now()}`
        }, {
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': API_KEY,
                'x-customer-id': CUSTOMER_ID
            },
            timeout: 30000
        });

        if (response.data.success) {
            console.log(`✅ SUCCESS - ${amount} MXN`);
            console.log(`   Transaction ID: ${response.data.transaction.operatorTransactionId}`);
            console.log(`   Status: ${response.data.transaction.status}`);
            console.log(`   USD Deducted: $${response.data.billing.deducted_usd}`);
            console.log(`   Balance After: $${response.data.remaining_balance}`);
            return { amount, success: true, txId: response.data.transaction.operatorTransactionId };
        } else {
            console.log(`❌ FAILED - ${amount} MXN`);
            console.log(`   Error: ${response.data.error || response.data.message}`);
            return { amount, success: false, error: response.data.error };
        }

    } catch (error) {
        console.log(`❌ ERROR - ${amount} MXN`);
        console.log(`   ${error.response?.data?.error || error.message}`);
        return { amount, success: false, error: error.message };
    }
}

async function runAllTests() {
    console.log('\n╔═══════════════════════════════════════════════════════╗');
    console.log('║  🧪 XOOM Products Test Suite - Latcom Provider      ║');
    console.log('╚═══════════════════════════════════════════════════════╝\n');
    console.log(`📞 Target Phone: ${PHONE}`);
    console.log(`🎯 Products to Test: ${XOOM_AMOUNTS.join(', ')} MXN`);
    console.log(`📊 Total Tests: ${XOOM_AMOUNTS.length}`);

    const results = [];
    let totalSuccess = 0;
    let totalFailed = 0;
    let totalUSD = 0;

    // Run tests sequentially with 2 second delay between each
    for (const amount of XOOM_AMOUNTS) {
        const result = await testTopup(amount);
        results.push(result);

        if (result.success) {
            totalSuccess++;
        } else {
            totalFailed++;
        }

        // Wait 2 seconds between transactions
        if (amount !== 100) {
            console.log(`\n⏳ Waiting 2 seconds before next test...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }

    // Summary
    console.log('\n\n╔═══════════════════════════════════════════════════════╗');
    console.log('║  📊 TEST RESULTS SUMMARY                             ║');
    console.log('╚═══════════════════════════════════════════════════════╝\n');

    console.log(`✅ Successful: ${totalSuccess}/${XOOM_AMOUNTS.length}`);
    console.log(`❌ Failed: ${totalFailed}/${XOOM_AMOUNTS.length}`);

    if (totalSuccess > 0) {
        console.log('\n✅ Successful Transactions:');
        results.filter(r => r.success).forEach(r => {
            console.log(`   • ${r.amount} MXN - TX: ${r.txId}`);
        });
    }

    if (totalFailed > 0) {
        console.log('\n❌ Failed Transactions:');
        results.filter(r => !r.success).forEach(r => {
            console.log(`   • ${r.amount} MXN - Error: ${r.error}`);
        });
    }

    const totalMXN = results.filter(r => r.success).reduce((sum, r) => sum + r.amount, 0);
    console.log(`\n💰 Total Amount Sent: ${totalMXN} MXN`);
    console.log(`📞 Phone: ${PHONE}`);
    console.log('');
}

runAllTests().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
