const BaseProvider = require('./base-provider');

/**
 * Mock Provider for Testing
 * Simulates provider responses without making real API calls
 */
class MockProvider extends BaseProvider {
    constructor() {
        super('MOCK', {
            testMode: true
        });
        this.isConfigured = true;
        console.log('✅ Mock provider initialized (TEST MODE)');
    }

    getCapabilities() {
        return {
            topups: true,
            billPayments: true,
            vouchers: true,
            countries: ['MX', 'US', 'CO', 'BR'],
            operators: ['TELCEL', 'AT&T', 'MOVISTAR'],
            currencies: ['USD', 'MXN'],
            features: ['test_mode', 'instant_response']
        };
    }

    /**
     * Mock topup - always succeeds
     */
    async topup(transaction) {
        const startTime = Date.now();
        
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const { phone, amount, skuId } = transaction;
        const mockTxId = `MOCK_${Date.now()}`;
        
        console.log(`🧪 [MOCK] Simulating topup: ${phone} - ${amount} - SKU: ${skuId || 'N/A'}`);
        
        return {
            success: true,
            provider: 'MOCK',
            providerTransactionId: mockTxId,
            message: 'Mock transaction successful (TEST MODE)',
            responseTime: Date.now() - startTime,
            responseCode: '00',
            testMode: true
        };
    }

    /**
     * Mock bill payment
     */
    async billPayment(payment) {
        const startTime = Date.now();
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const mockTxId = `MOCK_BILL_${Date.now()}`;
        
        return {
            success: true,
            provider: 'MOCK',
            providerTransactionId: mockTxId,
            message: 'Mock bill payment successful (TEST MODE)',
            responseTime: Date.now() - startTime,
            testMode: true
        };
    }

    /**
     * Mock voucher purchase
     */
    async purchaseVoucher(voucher) {
        const startTime = Date.now();
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const mockTxId = `MOCK_VCH_${Date.now()}`;
        
        return {
            success: true,
            provider: 'MOCK',
            providerTransactionId: mockTxId,
            message: 'Mock voucher purchase successful (TEST MODE)',
            pins: ['MOCK-PIN-123456'],
            responseTime: Date.now() - startTime,
            testMode: true
        };
    }

    /**
     * Mock balance check
     */
    async checkBalance() {
        return {
            success: true,
            balance: 99999.99,
            currency: 'USD',
            provider: 'MOCK',
            message: 'Unlimited test balance',
            testMode: true
        };
    }

    /**
     * Mock phone lookup
     */
    async lookupPhone(phone) {
        return {
            success: true,
            phone: phone,
            operator: 'TELCEL',
            country: 'MEXICO',
            valid: true,
            testMode: true
        };
    }

    /**
     * Mock transaction status
     */
    async getTransactionStatus(providerTransactionId) {
        return {
            success: true,
            status: 'completed',
            providerTransactionId: providerTransactionId,
            testMode: true
        };
    }

    /**
     * Mock products
     */
    async getProducts(country = null) {
        return [
            {
                productId: 'MOCK_TELCEL_20',
                skuId: '396',
                operator: 'TELCEL',
                country: 'MEXICO',
                amount: 20,
                currency: 'MXN',
                description: 'Mock Telcel 20 MXN'
            },
            {
                productId: 'MOCK_ATT_20',
                skuId: '683',
                operator: 'AT&T',
                country: 'MEXICO',
                amount: 20,
                currency: 'MXN',
                description: 'Mock AT&T 20 MXN'
            }
        ];
    }
}

module.exports = MockProvider;
