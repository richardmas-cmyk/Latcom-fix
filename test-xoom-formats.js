const latcomAPI = require('./latcom-api');

async function testXoomFormats() {
    const phone = '5615870508';

    const formats = [
        { productId: 'XOOM_010_MXN', amount: 10, description: 'Original format (uppercase, 3 digits)' },
        { productId: 'Xoom_10_MXN', amount: 10, description: 'Lowercase with 2 digits' },
        { productId: 'XOOM_10_MXN', amount: 10, description: 'Uppercase with 2 digits' },
        { productId: 'xoom_010_mxn', amount: 10, description: 'All lowercase, 3 digits' },
        { productId: 'Xoom_010_MXN', amount: 10, description: 'Mixed case, 3 digits' }
    ];

    console.log('🧪 Testing different XOOM product ID formats...\n');

    for (const format of formats) {
        console.log(`\n📝 Testing: ${format.description}`);
        console.log(`   Product ID: ${format.productId}`);
        console.log(`   Amount: ${format.amount} MXN`);

        try {
            const product = {
                productId: format.productId,
                skuId: '0',
                amount: format.amount,
                currency: 'MXN',
                service: 2
            };

            const result = await latcomAPI.testProduct(phone, product);

            if (result.success) {
                console.log(`   ✅ SUCCESS: ${result.message}`);
                console.log(`   Transaction ID: ${result.operatorTransactionId}`);
            } else {
                console.log(`   ❌ FAILED: ${result.message}`);
                if (result.data?.vendorResponseCode) {
                    console.log(`   Error Code: ${result.data.vendorResponseCode}`);
                }
            }
        } catch (error) {
            console.log(`   ❌ ERROR: ${error.message}`);
        }

        // Wait 2 seconds between tests
        await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log('\n\n✅ All format tests completed!');
    process.exit(0);
}

testXoomFormats().catch(error => {
    console.error('❌ Test failed:', error);
    process.exit(1);
});
