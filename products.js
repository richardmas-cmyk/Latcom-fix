const LATCOM_PRODUCTS = {
    topupSku: "0",
    topupProductId: "TFE_MEXICO_TOPUP_103_2579_MXN",
    bundles: [
        { amount: 50, skuId: "BFRIQUIN", productId: "TEMXN_BFRIQUIN_28_DAYS" }
    ]
};

function selectProduct(amount, type) {
    if (type === 'topup') {
        return {
            skuId: LATCOM_PRODUCTS.topupSku,
            productId: LATCOM_PRODUCTS.topupProductId,
            service: 2,
            amount: amount
        };
    }
    
    return {
        skuId: LATCOM_PRODUCTS.bundles[0].skuId,
        productId: LATCOM_PRODUCTS.bundles[0].productId,
        service: 1,
        amount: 0
    };
}

module.exports = { LATCOM_PRODUCTS, selectProduct };
