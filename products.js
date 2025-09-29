// LATCOM Product Mappings - Updated from actual API
const LATCOM_PRODUCTS = {
    bundles: [
        { amount: 7, skuId: 'BFRISEM', productId: 'TEMXN_BFRISEM_7_DAYS', days: 7 },
        { amount: 10, skuId: 'BFRIQUIN', productId: 'TEMXN_BFRIQUIN_28_DAYS', days: 28 },
        { amount: 15, skuId: 'BFRIMEN', productId: 'TEMXN_BFRIMEN_15_DAYS', days: 15 },
        { amount: 18, skuId: 'BFRECINT', productId: 'TEMXN_BFRECINT_30_DAYS', days: 30 },
        { amount: 20, skuId: 'BFSPRINT', productId: 'TEMXN_BFSPRINT_UNLIMITED_30_DAYS', days: 30 }
    ],
    
    topupSku: '0',
    topupProductId: 'TFE_MEXICO_TOPUP_103_2579_MXN'
};

function selectProduct(amountToProvider, productType) {
    if (productType === 'topup') {
        return {
            skuId: LATCOM_PRODUCTS.topupSku,
            productId: LATCOM_PRODUCTS.topupProductId,
            service: 2,
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
        service: 1,
        amount: 0
    };
}

module.exports = { LATCOM_PRODUCTS, selectProduct };
