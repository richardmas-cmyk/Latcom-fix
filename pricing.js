const PRICING_CONFIG = {
    PROVIDER_DISCOUNT: 0.24,
    CUSTOMER_DISCOUNT: 0.12,
    FOREX_SPREAD: 0.05,
    TOPUP_THRESHOLD: 6.00
};

function calculatePricing(customerRequestAmount) {
    const customerDiscount = customerRequestAmount * PRICING_CONFIG.CUSTOMER_DISCOUNT;
    const customerPays = customerRequestAmount - customerDiscount;
    const forexSpread = customerPays * PRICING_CONFIG.FOREX_SPREAD;
    const amountToProvider = customerPays - forexSpread;
    const providerDiscount = amountToProvider * PRICING_CONFIG.PROVIDER_DISCOUNT;
    const wholesaleCost = amountToProvider - providerDiscount;
    const marginRetained = customerPays - wholesaleCost;
    const profit = marginRetained;
    const productType = customerRequestAmount < PRICING_CONFIG.TOPUP_THRESHOLD ? 'topup' : 'bundle';
    
    return {
        customerRequestAmount: parseFloat(customerRequestAmount.toFixed(2)),
        customerDiscount: parseFloat(customerDiscount.toFixed(2)),
        customerPays: parseFloat(customerPays.toFixed(2)),
        forexSpread: parseFloat(forexSpread.toFixed(2)),
        amountToProvider: parseFloat(amountToProvider.toFixed(2)),
        providerDiscount: parseFloat(providerDiscount.toFixed(2)),
        wholesaleCost: parseFloat(wholesaleCost.toFixed(2)),
        marginRetained: parseFloat(marginRetained.toFixed(2)),
        profit: parseFloat(profit.toFixed(2)),
        productType: productType
    };
}

module.exports = { calculatePricing, PRICING_CONFIG };
