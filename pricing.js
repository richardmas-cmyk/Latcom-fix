const PRICING_CONFIG = {
    PROVIDER_DISCOUNT: 0.24,      // LATCOM gives 24% discount
    CUSTOMER_DISCOUNT: 0.12,      // We give customer 12% discount
    TOPUP_THRESHOLD: 6.00,        // Under $6 = top-up, $6+ = bundle
    EFFECTIVE_MARGIN: 0.12        // Our retained margin
};

function calculatePricing(customerRequestAmount) {
    // Step 1: Apply customer discount (12%)
    const customerDiscount = customerRequestAmount * PRICING_CONFIG.CUSTOMER_DISCOUNT;
    const customerPays = customerRequestAmount - customerDiscount;
    
    // Step 2: Amount to provider (no forex spread anymore)
    const amountToProvider = customerPays;
    
    // Step 3: Calculate wholesale cost (LATCOM charges 76% after 24% discount)
    const providerDiscount = amountToProvider * PRICING_CONFIG.PROVIDER_DISCOUNT;
    const wholesaleCost = amountToProvider - providerDiscount;
    
    // Step 4: Calculate our margin and profit
    const marginRetained = customerPays - wholesaleCost;
    const profit = marginRetained;
    
    // Step 5: Determine product type
    const productType = customerRequestAmount < PRICING_CONFIG.TOPUP_THRESHOLD ? 'topup' : 'bundle';
    
    return {
        customerRequestAmount: parseFloat(customerRequestAmount.toFixed(2)),
        customerDiscount: parseFloat(customerDiscount.toFixed(2)),
        customerPays: parseFloat(customerPays.toFixed(2)),
        forexSpread: 0, // No longer used but keep for database compatibility
        amountToProvider: parseFloat(amountToProvider.toFixed(2)),
        providerDiscount: parseFloat(providerDiscount.toFixed(2)),
        wholesaleCost: parseFloat(wholesaleCost.toFixed(2)),
        marginRetained: parseFloat(marginRetained.toFixed(2)),
        profit: parseFloat(profit.toFixed(2)),
        productType: productType
    };
}

module.exports = { calculatePricing, PRICING_CONFIG };
