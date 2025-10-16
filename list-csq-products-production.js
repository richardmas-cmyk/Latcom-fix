/**
 * List all available CSQ products from PRODUCTION terminal 180167
 */

require('dotenv').config({ path: '.env.production' });
const CSQProvider = require('./providers/csq-provider');

async function listProductsProduction() {
    console.log('🔴 PRODUCTION ENVIRONMENT - Terminal 180167\n');

    const csq = new CSQProvider();
    const products = await csq.getProducts();

    console.log('\n📦 CSQ Production Products Available\n');
    console.log('Total products:', products.length);
    console.log('='.repeat(100));

    // Group by country
    const byCountry = {};
    products.forEach(p => {
        if (!byCountry[p.country]) byCountry[p.country] = [];
        byCountry[p.country].push(p);
    });

    Object.keys(byCountry).sort().forEach(country => {
        console.log(`\n🌍 ${country} (${byCountry[country].length} products):`);
        console.log('-'.repeat(100));
        byCountry[country].forEach(p => {
            console.log(`  • ${p.operator.padEnd(35)} | SKU: ${String(p.skuId).padEnd(6)} | ${p.denominations}`);
        });
    });

    console.log('\n' + '='.repeat(100));

    // Show Mexico products specifically
    const mexicoProducts = products.filter(p => p.country === 'Mexico');
    if (mexicoProducts.length > 0) {
        console.log('\n🇲🇽 MEXICO PRODUCTS DETAIL:\n');
        mexicoProducts.forEach(p => {
            console.log(`Product: ${p.operator}`);
            console.log(`  SKU ID: ${p.skuId}`);
            console.log(`  Denominations: ${p.denominations}`);
            console.log(`  Exchange: ${p.exchangeRate} ${p.exchangeUnits}`);
            console.log(`  MSISDN Mask: ${p.msisdnMask || 'None'}`);
            console.log('');
        });
    }

    console.log('💡 To use a product, call csq.topup() with the SKU ID');
    console.log('   Example: { phone: "5551234567", amount: 5, skuId: "7952", country: "MX" }\n');
}

listProductsProduction().catch(error => {
    console.error('❌ Error:', error.message);
    process.exit(1);
});
