#!/usr/bin/env node
const axios = require('axios');
const crypto = require('crypto');

async function getProductionTerminalProducts() {
    console.log('Checking Production Terminal 180167 Products');
    console.log('='.repeat(80));
    console.log('');

    const username = 'host.180167';
    const password = 'z5r3rr3s96';

    try {
        // Calculate token (SHA256 of username + password)
        const tokenString = username + password;
        const token = crypto.createHash('sha256').update(tokenString).digest('hex');

        console.log('Token:', token.substring(0, 20) + '...');
        console.log('Getting products from CSQ API...');
        console.log('');

        const response = await axios.get(
            'https://evsbus.csqworld.com/article/view-set/saleconditions/customer-config/180167/0',
            {
                headers: {
                    'Token': token,
                    'Accept': 'application/json'
                },
                timeout: 30000
            }
        );

        const products = response.data;

        console.log('✅ Success! Total products:', products.length);
        console.log('');

        // Group by country
        const byCountry = {};
        products.forEach(p => {
            const country = p.country || 'Unknown';
            if (!byCountry[country]) {
                byCountry[country] = [];
            }
            byCountry[country].push(p);
        });

        // Display all products
        console.log('PRODUCTS BY COUNTRY');
        console.log('='.repeat(80));
        console.log('');

        Object.keys(byCountry).sort().forEach(country => {
            console.log(`🌍 ${country} (${byCountry[country].length} products)`);
            console.log('-'.repeat(80));
            byCountry[country].forEach(p => {
                console.log(`  • SKU ${p.skuId}: ${p.productName}`);
                if (p.denominations) {
                    const denoms = p.denominations.slice(0, 5);
                    console.log(`    Amounts: ${denoms.join(', ')}${p.denominations.length > 5 ? '...' : ''}`);
                }
            });
            console.log('');
        });

        // Highlight Mexico products
        if (byCountry['Mexico']) {
            console.log('🇲🇽 MEXICO PRODUCTS DETAIL');
            console.log('='.repeat(80));
            byCountry['Mexico'].forEach(p => {
                console.log('');
                console.log('Product:', p.productName);
                console.log('SKU ID:', p.skuId);
                console.log('Denominations:', p.denominations ? p.denominations.join(', ') : 'None');
            });
        } else {
            console.log('');
            console.log('⚠️  WARNING: NO MEXICO PRODUCTS FOUND ON TERMINAL 180167');
        }

    } catch (error) {
        console.error('');
        console.error('❌ Error:', error.message);
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Response:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

getProductionTerminalProducts();
