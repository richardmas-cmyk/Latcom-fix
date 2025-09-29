// LATCOM Product Mappings for Telefonica Mexico
const LATCOM_PRODUCTS = {
    // Bundles with specific SKUs (amounts $6 and above based on your pricing logic)
    bundles: [
        { amount: 7.5, skuId: 'BFRISEM', productId: 'TFE_MEXICO_7DAYS_7.5USD', days: 7 },
        { amount: 16.5, skuId: 'BFRIMEN', productId: 'TFE_MEXICO_15DAYS_16.5USD', days: 15 },
        { amount: 11, skuId: 'BFRIQUIN', productId: 'TFE_MEXICO_28DAY_11USD', days: 28 },
        { amount: 20, skuId: 'BFRECINT', productId: 'TFE_MEXICO_30DAYS_20USD', days: 30 },
        { amount: 22, skuId: 'BFSPRINT', productId: 'TFE_MEXICO_30DAYS_22USD', days: 30 }
    ],
    
    // Top-ups use SKU "0" and open amounts (under $6)
    topupSku: '0',
    topupProductId: 'TFE_MEXICO_TOPUP_103_2579_MXN'
};

function selectProduct(amountToProvider, productType) {
    if (productType === 'topup') {
        return {
            skuId: LATCOM_PRODUCTS.topupSku,
            productId: LATCOM_PRODUCTS.topupProductId,
            service: 2, // 2 = top-up
            amount: amountToProvider
        };
    }
    
    // For bundles, find closest match
    const sorted = LATCOM_PRODUCTS.bundles.sort((a, b) => 
        Math.abs(a.amount - amountToProvider) - Math.abs(b.amount - amountToProvider)
    );
    
    const selected = sorted[0];
    return {
        skuId: selected.skuId,
        productId: selected.productId,
        service: 1, // 1 = bundle
        amount: 0 // Bundles don't send amount
    };
}

module.exports = { LATCOM_PRODUCTS, selectProduct };
