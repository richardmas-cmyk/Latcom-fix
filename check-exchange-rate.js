const forexConverter = require('./forex-converter');
const axios = require('axios');

async function checkExchangeRates() {
    console.log('\n╔═══════════════════════════════════════════════════════╗');
    console.log('║  💱 EXCHANGE RATE CHECK - MXN to USD                 ║');
    console.log('╚═══════════════════════════════════════════════════════╝\n');

    try {
        // 1. Get current rate from our forex converter (cached)
        console.log('📊 Current Rate (Relier Hub System):');
        const rateInfo = forexConverter.getRateInfo();
        if (rateInfo.available) {
            console.log(`   Rate: 1 MXN = $${rateInfo.rate} USD`);
            console.log(`   Last Updated: ${rateInfo.lastUpdated}`);
            console.log(`   Age: ${rateInfo.ageMinutes} minutes`);
            console.log(`   Status: ${rateInfo.isFresh ? '✅ Fresh' : '⚠️  Stale'}`);
        } else {
            console.log('   ⚠️  No cached rate available');
        }

        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        // 2. Fetch fresh rate
        console.log('🔄 Fetching Fresh Exchange Rate...');
        const freshRate = await forexConverter.getMXNtoUSD();
        console.log(`   ✅ Fresh Rate: 1 MXN = $${freshRate} USD`);

        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        // 3. Calculate conversions for common amounts
        console.log('💰 Open Range Topup Calculations (MXN → USD):');
        console.log('');

        const amounts = [25, 35, 45, 75, 125, 250, 500, 1000];

        for (const amountMXN of amounts) {
            const conversion = await forexConverter.convertMXNtoUSD(amountMXN);
            console.log(`   ${amountMXN.toString().padStart(4)} MXN  →  $${conversion.amountUSD.toString().padStart(6)} USD`);
        }

        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        // 4. Show exchange rate from multiple sources
        console.log('🌍 Exchange Rates from Multiple Sources:');
        console.log('');

        // ExchangeRate-API (what we use)
        try {
            const er1 = await axios.get('https://api.exchangerate-api.com/v4/latest/MXN');
            console.log(`   ExchangeRate-API:  1 MXN = $${er1.data.rates.USD} USD`);
        } catch (e) {
            console.log('   ExchangeRate-API:  ❌ Failed');
        }

        // Open Exchange Rates (alternative)
        try {
            const er2 = await axios.get('https://open.er-api.com/v6/latest/MXN');
            console.log(`   Open-ER-API:       1 MXN = $${er2.data.rates.USD} USD`);
        } catch (e) {
            console.log('   Open-ER-API:       ❌ Failed');
        }

        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        // 5. Important notes
        console.log('📝 IMPORTANT NOTES:');
        console.log('');
        console.log('   • Latcom does NOT provide their own exchange rate');
        console.log('   • They charge in MXN and you pay in MXN');
        console.log('   • Our system converts MXN → USD for billing purposes only');
        console.log('   • Exchange rate is cached for 1 hour to reduce API calls');
        console.log('');
        console.log('   • XOOM Products: Fixed amounts (10, 20, 30, 50, 60, 100 MXN)');
        console.log('   • Open Range: TFE_MXN_20_TO_2000 (any amount from 20-2000 MXN)');
        console.log('');
        console.log('   • Current Rate: 1 MXN = $' + freshRate + ' USD');
        console.log('   • Example: 100 MXN topup costs you $' + (100 * freshRate).toFixed(2) + ' USD');

        console.log('\n╔═══════════════════════════════════════════════════════╗');
        console.log('║  ✅ EXCHANGE RATE CHECK COMPLETE                     ║');
        console.log('╚═══════════════════════════════════════════════════════╝\n');

    } catch (error) {
        console.error('\n❌ Error:', error.message);
    }
}

checkExchangeRates();
