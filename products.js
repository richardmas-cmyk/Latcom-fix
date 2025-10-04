/**
 * Latcom Product Catalog
 * Complete list of available products for Telefónica México
 */

const LATCOM_PRODUCTS = {
    // Bundles (Service 1)
    bundles: [
        {
            productId: "TEMXN_BFRISEM_7_DAYS",
            skuId: "BFRISEM",
            amount: 0,
            currency: "USD",
            service: 1,
            price_usd: 7.5,
            description: "2.3GB; 1.15GB YyTT; 30días; min y sms ilimitados a México, EUA y Canadá"
        },
        {
            productId: "TEMXN_BFRIQUIN_28_DAYS",
            skuId: "BFRIQUIN",
            amount: 0,
            currency: "USD",
            service: 1,
            price_usd: 11,
            description: "3GB; 1.5GB YyTT; 30días; min y sms ilimitados a México, EUA y Canadá"
        },
        {
            productId: "TEMXN_BFRIMEN_15_DAYS",
            skuId: "BFRIMEN",
            amount: 0,
            currency: "USD",
            service: 1,
            price_usd: 16.5,
            description: "8GB; 2GB YyN; 30días; min y sms ilimitados a México, EUA y Canadá"
        },
        {
            productId: "TEMXN_BFRECINT_30_DAYS",
            skuId: "BFRECINT",
            amount: 0,
            currency: "USD",
            service: 1,
            price_usd: 20,
            description: "12GB; 3GB YyN; 30días"
        },
        {
            productId: "TEMXN_BFSPRINT_UNLIMITED_30_DAYS",
            skuId: "BFSPRINT",
            amount: 0,
            currency: "USD",
            service: 1,
            price_usd: 22,
            description: "Ilimitado GB; 30días; min y sms ilimitados a México, EUA y Canadá"
        }
    ],

    // Open Range Topup (Service 2)
    openRange: {
        productId: "TFE_MEXICO_TOPUP_103_2579_MXN",
        skuId: "0",
        currency: "USD",
        service: 2,
        min_amount: 0,
        max_amount: 150,
        description: "Tiempo aire en rango abierto de recarga (0-150 USD)"
    },

    // Fixed Amount Topups - MXN (Service 2)
    fixedTopups: [
        { productId: "XOOM_10_MXN", skuId: "0", amount: 10, currency: "MXN", service: 2, description: "Tiempo aire 10 pesos" },
        { productId: "XOOM_20_MXN", skuId: "0", amount: 20, currency: "MXN", service: 2, description: "Tiempo aire 20 pesos" },
        { productId: "XOOM_30_MXN", skuId: "0", amount: 30, currency: "MXN", service: 2, description: "Tiempo aire 30 pesos" },
        { productId: "XOOM_40_MXN", skuId: "0", amount: 40, currency: "MXN", service: 2, description: "Tiempo aire 40 pesos" },
        { productId: "XOOM_50_MXN", skuId: "0", amount: 50, currency: "MXN", service: 2, description: "Tiempo aire 50 pesos" },
        { productId: "XOOM_60_MXN", skuId: "0", amount: 60, currency: "MXN", service: 2, description: "Tiempo aire 60 pesos" },
        { productId: "XOOM_70_MXN", skuId: "0", amount: 70, currency: "MXN", service: 2, description: "Tiempo aire 70 pesos" },
        { productId: "XOOM_80_MXN", skuId: "0", amount: 80, currency: "MXN", service: 2, description: "Tiempo aire 80 pesos" },
        { productId: "XOOM_90_MXN", skuId: "0", amount: 90, currency: "MXN", service: 2, description: "Tiempo aire 90 pesos" },
        { productId: "XOOM_100_MXN", skuId: "0", amount: 100, currency: "MXN", service: 2, description: "Tiempo aire 100 pesos" },
        { productId: "XOOM_150_MXN", skuId: "0", amount: 150, currency: "MXN", service: 2, description: "Tiempo aire 150 pesos" },
        { productId: "XOOM_200_MXN", skuId: "0", amount: 200, currency: "MXN", service: 2, description: "Tiempo aire 200 pesos" },
        { productId: "XOOM_300_MXN", skuId: "0", amount: 300, currency: "MXN", service: 2, description: "Tiempo aire 300 pesos" },
        { productId: "XOOM_500_MXN", skuId: "0", amount: 500, currency: "MXN", service: 2, description: "Tiempo aire 500 pesos" }
    ]
};

/**
 * Get product by ID
 */
function getProductById(productId) {
    // Check bundles
    const bundle = LATCOM_PRODUCTS.bundles.find(p => p.productId === productId);
    if (bundle) return bundle;

    // Check open range
    if (LATCOM_PRODUCTS.openRange.productId === productId) {
        return LATCOM_PRODUCTS.openRange;
    }

    // Check fixed topups
    const topup = LATCOM_PRODUCTS.fixedTopups.find(p => p.productId === productId);
    if (topup) return topup;

    return null;
}

/**
 * Get all products as array
 */
function getAllProducts() {
    return [
        ...LATCOM_PRODUCTS.bundles,
        LATCOM_PRODUCTS.openRange,
        ...LATCOM_PRODUCTS.fixedTopups
    ];
}

/**
 * Select product based on amount and type
 */
function selectProduct(amount, type) {
    if (type === 'topup') {
        return {
            skuId: LATCOM_PRODUCTS.openRange.skuId,
            productId: LATCOM_PRODUCTS.openRange.productId,
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

module.exports = {
    LATCOM_PRODUCTS,
    selectProduct,
    getProductById,
    getAllProducts
};
