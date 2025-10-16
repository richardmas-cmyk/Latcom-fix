#!/usr/bin/env node
/**
 * Test MUWE OXXO Payment Voucher Creation
 * Generate barcode for customer to pay 10 MXN at OXXO store
 */

const MUWEProvider = require('./providers/muwe-provider');

async function testOXXOVoucher() {
    // Use MUWE sandbox test credentials (for OXXO API)
    process.env.MUWE_BASE_URL = 'https://test.sipelatam.mx';
    process.env.MUWE_MER_CODE = '880624000000277'; // Sandbox merchant for bill payment
    process.env.MUWE_APP_ID = '00423574685'; // Sandbox App ID for OXXO
    process.env.MUWE_MCH_ID = '880924000000423'; // Sandbox Merchant ID for OXXO
    process.env.MUWE_SECRET_KEY = 'ZtIPVopZCwxLiJgrs68MPgNOorWx9CzT';
    process.env.MUWE_ENVIRONMENT = 'test';

    const muwe = new MUWEProvider();

    console.log('\n' + '='.repeat(80));
    console.log('🏪 MUWE OXXO Payment Voucher Test');
    console.log('='.repeat(80));
    console.log('');
    console.log('Customer Phone: +52 55 1951 9128');
    console.log('Amount: 10 MXN');
    console.log('Purpose: Generate barcode for customer to pay cash at OXXO');
    console.log('');
    console.log('='.repeat(80));
    console.log('');

    try {
        const result = await muwe.oxxoPayment({
            amount: 10, // 10 MXN
            reference: `OXXO_5519519128_${Date.now()}`,
            notifyUrl: 'https://latcom-fix-production.up.railway.app/webhook/muwe/oxxo'
        });

        if (result.success) {
            console.log('✅ OXXO VOUCHER CREATED SUCCESSFULLY!');
            console.log('');
            console.log('📱 Send this information to +52 55 1951 9128:');
            console.log('─'.repeat(80));
            console.log('');
            console.log('💰 Amount to Pay: 10 MXN');
            console.log('🏪 Pay at: Any OXXO store in Mexico');
            console.log('📅 Expires: ' + new Date(result.expiresAt).toLocaleString('es-MX', {
                timeZone: 'America/Mexico_City',
                dateStyle: 'full',
                timeStyle: 'short'
            }));
            console.log('');
            console.log('📋 Reference Number: ' + result.reference);
            console.log('');
            console.log('🖼️  Barcode Image URL:');
            console.log(result.barcodeUrl);
            console.log('');
            console.log('🔗 Payment Page URL (send this link):');
            console.log(result.paymentUrl);
            console.log('');
            console.log('─'.repeat(80));
            console.log('');
            console.log('📲 Instructions for customer:');
            console.log('1. Open the payment link on your phone');
            console.log('2. Show the barcode to the OXXO cashier');
            console.log('3. Pay 10 MXN in cash');
            console.log('4. Keep your receipt');
            console.log('5. Payment will be confirmed within minutes');
            console.log('');
            console.log('─'.repeat(80));
            console.log('');
            console.log('📊 Technical Details:');
            console.log('');
            console.log('Provider Transaction ID: ' + result.providerTransactionId);
            console.log('Response Time: ' + result.responseTime + 'ms');
            console.log('');
            console.log('Full Response:');
            console.log(JSON.stringify(result.rawResponse, null, 2));
            console.log('');

        } else {
            console.log('❌ OXXO VOUCHER CREATION FAILED');
            console.log('');
            console.log('Error Message: ' + result.message);
            if (result.errorCode) {
                console.log('Error Code: ' + result.errorCode);
            }
            console.log('');
            if (result.rawResponse) {
                console.log('Full Response:');
                console.log(JSON.stringify(result.rawResponse, null, 2));
            }
        }

    } catch (error) {
        console.log('❌ FATAL ERROR');
        console.log('');
        console.log('Error: ' + error.message);
        console.log('');
        if (error.stack) {
            console.log('Stack Trace:');
            console.log(error.stack);
        }
    }

    console.log('');
    console.log('='.repeat(80));
}

// Run test
testOXXOVoucher().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
