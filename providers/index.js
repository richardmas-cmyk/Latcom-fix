/**
 * Relier Hub Provider System
 * Multi-provider aggregation for topups, bill payments, and vouchers
 */

const ProviderRouter = require('./provider-router');
const LatcomProvider = require('./latcom-provider');
const PPNProvider = require('./ppn-provider');
const CSQProvider = require('./csq-provider');
const MUWEProvider = require('./muwe-provider');
const PaymentsMexicoProvider = require('./payments-mexico-provider');
const BaseProvider = require('./base-provider');

// Create singleton router instance
const router = new ProviderRouter();

module.exports = {
    // Main router (recommended for most use cases)
    router,

    // Individual providers (for direct access if needed)
    LatcomProvider,
    PPNProvider,
    CSQProvider,
    MUWEProvider,
    PaymentsMexicoProvider,
    BaseProvider,

    // Convenience exports
    processTopup: (tx) => router.processTopup(tx),
    processBillPayment: (payment) => router.processBillPayment(payment),
    processVoucher: (voucher) => router.processVoucher(voucher),
    getAllProducts: (country) => router.getAllProducts(country),
    getProvider: (name) => router.getProvider(name),
    getConfiguredProviders: () => router.getConfiguredProviders()
};
