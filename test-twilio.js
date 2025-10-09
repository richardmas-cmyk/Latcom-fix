/**
 * Twilio Integration Test
 * Tests SMS and WhatsApp sending capabilities
 */

const twilioService = require('./lib/twilio-service');

async function testTwilio() {
    console.log('\n╔═══════════════════════════════════════════════════════╗');
    console.log('║  📱 Testing Twilio Integration                       ║');
    console.log('╚═══════════════════════════════════════════════════════╝\n');

    console.log('📋 Twilio Configuration:');
    console.log(`   Account SID: ${process.env.TWILIO_ACCOUNT_SID}`);
    console.log(`   Phone Number: ${process.env.TWILIO_PHONE_NUMBER}`);
    console.log(`   WhatsApp Number: ${process.env.TWILIO_WHATSAPP_NUMBER}`);
    console.log('');

    // Test 1: Send Test SMS
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📱 TEST 1: Send Test SMS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Replace with your test phone number
    const testPhone = process.env.TEST_PHONE || '+15551234567';
    console.log(`   Sending to: ${testPhone}`);
    console.log('   Note: Change TEST_PHONE env var or edit this script');
    console.log('');

    try {
        const smsResult = await twilioService.sendSMS(
            testPhone,
            '🎉 Test SMS from Relier Hub!\n\nThis is a test message to verify Twilio integration is working correctly.'
        );

        if (smsResult.success) {
            console.log('✅ SMS sent successfully!');
            console.log(`   Message SID: ${smsResult.messageSid}`);
            console.log(`   Status: ${smsResult.status}`);
        } else {
            console.log('❌ SMS failed:');
            console.log(`   Error: ${smsResult.error}`);
        }
    } catch (error) {
        console.log('❌ SMS error:', error.message);
    }

    console.log('\n');

    // Test 2: Send Transaction Notification
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('💳 TEST 2: Send Transaction Notification');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    try {
        const txResult = await twilioService.sendTransactionNotification({
            phone: testPhone,
            amount: 50,
            currency: 'MXN',
            status: 'SUCCESS',
            operatorTransactionId: 'TEST123456',
            provider: 'Latcom'
        }, ['sms']);

        if (txResult.sms?.success) {
            console.log('✅ Transaction notification sent!');
            console.log(`   Message SID: ${txResult.sms.messageSid}`);
        } else {
            console.log('❌ Transaction notification failed:');
            console.log(`   Error: ${txResult.sms?.error}`);
        }
    } catch (error) {
        console.log('❌ Transaction notification error:', error.message);
    }

    console.log('\n');

    // Test 3: Format different message types
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📝 TEST 3: Message Formatting Examples');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    console.log('\n✅ Success Message:');
    const successMsg = twilioService.formatTransactionMessage({
        amount: 100,
        currency: 'MXN',
        status: 'SUCCESS',
        operatorTransactionId: 'LT12345',
        phone: '5566374683',
        provider: 'Latcom'
    });
    console.log(successMsg);

    console.log('\n❌ Failed Message:');
    const failedMsg = twilioService.formatTransactionMessage({
        amount: 100,
        currency: 'MXN',
        status: 'FAILED',
        phone: '5566374683'
    });
    console.log(failedMsg);

    console.log('\n');

    // Summary
    console.log('╔═══════════════════════════════════════════════════════╗');
    console.log('║  📊 TEST SUMMARY                                     ║');
    console.log('╚═══════════════════════════════════════════════════════╝\n');

    console.log('🎯 Next Steps:');
    console.log('   1. Check your phone for test messages');
    console.log('   2. Configure webhooks in Twilio Console:');
    console.log('      https://console.twilio.com/us1/develop/phone-numbers');
    console.log('');
    console.log('   3. Set webhook URLs:');
    console.log('      SMS: https://latcom-fix-production.up.railway.app/webhook/twilio/sms');
    console.log('      WhatsApp: https://latcom-fix-production.up.railway.app/webhook/twilio/whatsapp');
    console.log('      Status: https://latcom-fix-production.up.railway.app/webhook/twilio/status');
    console.log('');
    console.log('   4. Test auto-reply by texting your Twilio number:');
    console.log('      Send "HELP" or "BALANCE" to +18663692305');
    console.log('');
}

// Environment variables must be set before running this script
// Set them in your shell or .env file:
// export TWILIO_ACCOUNT_SID=ACxxxxx...
// export TWILIO_AUTH_TOKEN=xxxxx...
// export TWILIO_PHONE_NUMBER=+1xxxxxxxxxx
// export TWILIO_WHATSAPP_NUMBER=whatsapp:+1xxxxxxxxxx
// export TEST_PHONE=+1xxxxxxxxxx  (your test phone number)

if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
    console.error('❌ Error: TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN must be set');
    console.log('\nSet environment variables first:');
    console.log('  export TWILIO_ACCOUNT_SID=ACxxxxx...');
    console.log('  export TWILIO_AUTH_TOKEN=xxxxx...');
    console.log('  export TWILIO_PHONE_NUMBER=+1xxxxxxxxxx');
    console.log('  export TEST_PHONE=+1xxxxxxxxxx');
    process.exit(1);
}

// Run test
testTwilio().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
