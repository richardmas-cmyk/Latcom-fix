/**
 * List all available CSQ products from terminal 173103
 */

require('dotenv').config({ path: '.env.staging' });
const CSQProvider = require('./providers/csq-provider');

async function listProducts() {
    const csq = new CSQProvider();
    const products = await csq.getProducts();

    console.log('\n📦 CSQ Products Available (Terminal 173103)\n');
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
    console.log('\n💡 To use a product, call csq.topup() with the SKU ID');
    console.log('   Example: { phone: "5551234567", amount: 5, skuId: "7952", country: "MX" }\n');
}

listProducts().catch(error => {
    console.error('❌ Error:', error.message);
    process.exit(1);
});
