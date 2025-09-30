function calculatePricing(amount, discountRate) {
    return {
        customerRequestAmount: amount,
        customerDiscount: amount * discountRate,
        amountToProvider: amount * (1 - discountRate),
        productType: amount > 100 ? 'bundle' : 'topup',
        wholesaleCost: amount * 0.85,
        profit: amount * 0.05
    };
}

module.exports = { calculatePricing };
