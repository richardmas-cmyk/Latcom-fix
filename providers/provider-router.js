const LatcomProvider = require('./latcom-provider');
const PPNProvider = require('./ppn-provider');
const CSQProvider = require('./csq-provider');
const MUWEProvider = require('./muwe-provider');
const PaymentsMexicoProvider = require('./payments-mexico-provider');
const MockProvider = require('./mock-provider');

/**
 * Provider Router
 * Intelligently selects the best provider for each transaction
 */
class ProviderRouter {
    constructor() {
        // Check if in test mode
        this.testMode = process.env.TEST_MODE === 'true' || process.env.NODE_ENV === 'staging';

        if (this.testMode) {
            console.log('🧪 TEST MODE ENABLED - Using mock provider');
            // In test mode, only use mock provider
            this.providers = {
                mock: new MockProvider()
            };
        } else {
            // Initialize all real providers
            this.providers = {
                latcom: new LatcomProvider(),
                ppn: new PPNProvider(),
                csq: new CSQProvider(),
                muwe: new MUWEProvider(),
                paymentsmexico: new PaymentsMexicoProvider()
            };
        }

        // Default routing preferences
        // ⚠️ DISABLED ROUTES: Latcom (IP blocked), PPN (sandbox only), MUWE (sandbox only)
        // ✅ ACTIVE: CSQ production terminal 180167 (but products not routed yet)
        this.preferences = {
            // Mexico topups: CSQ ONLY (Latcom blocked, PPN/MUWE are sandbox)
            mexico_topup: ['csq'],
            // International topups: CSQ only
            international_topup: ['csq'],
            // Bill payments: DISABLED (MUWE sandbox only, no production)
            bill_payment: [],
            // Vouchers: DISABLED (PPN sandbox only)
            voucher: [],
            // SPEI transfers: DISABLED (MUWE sandbox only)
            spei: [],
            // OXXO cash: DISABLED (MUWE sandbox only)
            oxxo: []
        };

        // Log configured providers
        this.logProviderStatus();
    }

    logProviderStatus() {
        console.log('\n📡 Provider Router Status:');
        Object.entries(this.providers).forEach(([name, provider]) => {
            const status = provider.isReady() ? '✅ READY' : '⚠️  NOT CONFIGURED';
            const capabilities = provider.getCapabilities();
            console.log(`  ${name.toUpperCase()}: ${status}`);
            if (provider.isReady()) {
                console.log(`    - Topups: ${capabilities.topups ? 'YES' : 'NO'}`);
                console.log(`    - Bill Payments: ${capabilities.billPayments ? 'YES' : 'NO'}`);
                console.log(`    - Vouchers: ${capabilities.vouchers ? 'YES' : 'NO'}`);
                if (capabilities.countries && capabilities.countries.length > 0) {
                    console.log(`    - Countries: ${capabilities.countries.length} supported`);
                }
            }
        });
        console.log('');
    }

    /**
     * Select best provider for a transaction
     * @param {Object} transaction - Transaction details
     * @param {string} transaction.type - 'topup', 'bill_payment', 'voucher'
     * @param {string} transaction.country - Country code
     * @param {string} transaction.preferredProvider - Optional provider preference
     * @returns {Object} Selected provider
     */
    selectProvider(transaction) {
        const { type = 'topup', country = 'MEXICO', preferredProvider } = transaction;

        // If a specific provider is requested, use it
        if (preferredProvider && this.providers[preferredProvider.toLowerCase()]) {
            const provider = this.providers[preferredProvider.toLowerCase()];
            if (provider.isReady()) {
                console.log(`🎯 [Router] Using preferred provider: ${preferredProvider}`);
                return provider;
            } else {
                console.log(`⚠️  [Router] Preferred provider ${preferredProvider} not ready, falling back to auto-select`);
            }
        }

        // Determine transaction category
        let category;
        if (type === 'bill_payment' || type === 'billpay') {
            category = 'bill_payment';
        } else if (type === 'voucher' || type === 'giftcard') {
            category = 'voucher';
        } else if (country.toUpperCase() === 'MEXICO' || country.toUpperCase() === 'MX') {
            category = 'mexico_topup';
        } else {
            category = 'international_topup';
        }

        // Get ordered list of providers for this category
        const providerOrder = this.preferences[category] || ['ppn', 'latcom', 'csq'];

        console.log(`🔀 [Router] Transaction type: ${category}`);
        console.log(`🔀 [Router] Provider priority: ${providerOrder.join(' → ')}`);

        // Find first available provider in priority order
        for (const providerName of providerOrder) {
            const provider = this.providers[providerName];

            if (!provider || !provider.isReady()) {
                console.log(`   ⏭️  Skipping ${providerName} (not configured)`);
                continue;
            }

            const capabilities = provider.getCapabilities();

            // Check if provider supports this transaction type
            if (type === 'bill_payment' && !capabilities.billPayments) {
                console.log(`   ⏭️  Skipping ${providerName} (no bill payment support)`);
                continue;
            }

            if (type === 'voucher' && !capabilities.vouchers) {
                console.log(`   ⏭️  Skipping ${providerName} (no voucher support)`);
                continue;
            }

            if (type === 'topup' && !capabilities.topups) {
                console.log(`   ⏭️  Skipping ${providerName} (no topup support)`);
                continue;
            }

            // Check if provider supports this country
            if (capabilities.countries && capabilities.countries.length > 0) {
                const countrySupported = capabilities.countries.some(c =>
                    c.toUpperCase() === country.toUpperCase() ||
                    c.toUpperCase() === country.substring(0, 2).toUpperCase()
                );

                if (!countrySupported) {
                    console.log(`   ⏭️  Skipping ${providerName} (country ${country} not supported)`);
                    continue;
                }
            }

            console.log(`   ✅ Selected provider: ${providerName.toUpperCase()}`);
            return provider;
        }

        // No provider found
        throw new Error(`No available provider for ${category} in ${country}`);
    }

    /**
     * Process a topup with automatic provider selection
     * Includes automatic failover if first provider fails
     */
    async processTopup(transaction) {
        const { country = 'MEXICO', enableFailover = true, preferredProvider } = transaction;

        // If in test mode, always use mock provider
        if (this.testMode) {
            console.log(`🧪 [Router] TEST MODE - Using mock provider`);
            const result = await this.providers.mock.topup(transaction);
            return result;
        }

        // If specific provider requested, use ONLY that provider (no failover)
        if (preferredProvider) {
            const providerName = preferredProvider.toLowerCase();
            const provider = this.providers[providerName];

            if (!provider) {
                throw new Error(`Provider ${preferredProvider} not found`);
            }

            if (!provider.isReady()) {
                throw new Error(`Provider ${preferredProvider} not configured`);
            }

            console.log(`🎯 [Router] Using ONLY preferred provider: ${preferredProvider.toUpperCase()}`);
            const result = await provider.topup(transaction);
            return result;
        }

        // Determine provider order
        const category = (country.toUpperCase() === 'MEXICO' || country.toUpperCase() === 'MX')
            ? 'mexico_topup' : 'international_topup';

        const providerOrder = this.preferences[category];

        let lastError = null;

        // Try each provider in order
        for (const providerName of providerOrder) {
            const provider = this.providers[providerName];

            if (!provider || !provider.isReady()) {
                continue;
            }

            try {
                console.log(`🔄 [Router] Attempting topup with ${providerName.toUpperCase()}...`);
                const result = await provider.topup(transaction);

                if (result.success) {
                    console.log(`✅ [Router] Topup successful with ${providerName.toUpperCase()}`);
                    return result;
                } else {
                    console.log(`❌ [Router] ${providerName.toUpperCase()} failed: ${result.message}`);
                    lastError = result.message;

                    if (!enableFailover) {
                        return result; // Return failure without trying other providers
                    }

                    // Continue to next provider
                }

            } catch (error) {
                console.error(`❌ [Router] ${providerName.toUpperCase()} error:`, error.message);
                lastError = error.message;

                if (!enableFailover) {
                    throw error; // Don't try other providers
                }

                // Continue to next provider
            }
        }

        // All providers failed
        return {
            success: false,
            provider: 'Router',
            message: `All providers failed. Last error: ${lastError}`,
            attemptedProviders: providerOrder
        };
    }

    /**
     * Process bill payment with automatic provider selection
     */
    async processBillPayment(payment) {
        try {
            const provider = this.selectProvider({ type: 'bill_payment', ...payment });
            return await provider.billPayment(payment);
        } catch (error) {
            console.error('❌ [Router] Bill payment routing error:', error.message);
            return {
                success: false,
                provider: 'Router',
                message: error.message
            };
        }
    }

    /**
     * Process voucher purchase with automatic provider selection
     */
    async processVoucher(voucher) {
        try {
            const provider = this.selectProvider({ type: 'voucher', ...voucher });
            return await provider.purchaseVoucher(voucher);
        } catch (error) {
            console.error('❌ [Router] Voucher routing error:', error.message);
            return {
                success: false,
                provider: 'Router',
                message: error.message
            };
        }
    }

    /**
     * Get all products from all providers
     */
    async getAllProducts(country = null) {
        const allProducts = [];

        for (const [name, provider] of Object.entries(this.providers)) {
            if (!provider.isReady()) continue;

            try {
                const products = await provider.getProducts(country);
                allProducts.push(...products);
            } catch (error) {
                console.error(`❌ [Router] Error getting products from ${name}:`, error.message);
            }
        }

        return allProducts;
    }

    /**
     * Get provider by name
     */
    getProvider(name) {
        return this.providers[name.toLowerCase()];
    }

    /**
     * Get all configured providers
     */
    getConfiguredProviders() {
        return Object.entries(this.providers)
            .filter(([_, provider]) => provider.isReady())
            .map(([name, provider]) => ({
                name: name,
                capabilities: provider.getCapabilities()
            }));
    }

    /**
     * Check status of all providers
     */
    async checkAllBalances() {
        const balances = {};

        for (const [name, provider] of Object.entries(this.providers)) {
            if (!provider.isReady()) {
                balances[name] = { success: false, message: 'Not configured' };
                continue;
            }

            try {
                balances[name] = await provider.checkBalance();
            } catch (error) {
                balances[name] = { success: false, error: error.message };
            }
        }

        return balances;
    }
}

module.exports = ProviderRouter;
