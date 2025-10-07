/**
 * Base Provider Interface
 * All payment providers must implement these methods
 */

class BaseProvider {
    constructor(name, config) {
        this.name = name;
        this.config = config;
        this.isConfigured = false;
    }

    /**
     * Check if provider is properly configured
     * @returns {boolean}
     */
    isReady() {
        return this.isConfigured;
    }

    /**
     * Get provider capabilities
     * @returns {Object} { topups: boolean, billPayments: boolean, vouchers: boolean, countries: [] }
     */
    getCapabilities() {
        throw new Error('getCapabilities() must be implemented by provider');
    }

    /**
     * Process a topup transaction
     * @param {Object} transaction - { phone, amount, currency, country, reference }
     * @returns {Promise<Object>} { success, providerTransactionId, message, responseTime }
     */
    async topup(transaction) {
        throw new Error('topup() must be implemented by provider');
    }

    /**
     * Process a bill payment
     * @param {Object} payment - { accountNumber, amount, billerCode, reference }
     * @returns {Promise<Object>} { success, providerTransactionId, message, responseTime }
     */
    async billPayment(payment) {
        throw new Error('billPayment() not supported by this provider');
    }

    /**
     * Purchase a voucher/pin
     * @param {Object} voucher - { productCode, quantity, reference }
     * @returns {Promise<Object>} { success, pins, message, responseTime }
     */
    async purchaseVoucher(voucher) {
        throw new Error('purchaseVoucher() not supported by this provider');
    }

    /**
     * Look up phone number details
     * @param {string} phone
     * @returns {Promise<Object>} { operator, country, valid }
     */
    async lookupPhone(phone) {
        throw new Error('lookupPhone() not supported by this provider');
    }

    /**
     * Get transaction status
     * @param {string} providerTransactionId
     * @returns {Promise<Object>} { status, details }
     */
    async getTransactionStatus(providerTransactionId) {
        throw new Error('getTransactionStatus() not supported by this provider');
    }

    /**
     * Get available products/SKUs
     * @param {string} country - Optional country filter
     * @returns {Promise<Array>} List of products
     */
    async getProducts(country = null) {
        throw new Error('getProducts() not supported by this provider');
    }

    /**
     * Check provider balance (if applicable)
     * @returns {Promise<Object>} { balance, currency }
     */
    async checkBalance() {
        throw new Error('checkBalance() not supported by this provider');
    }
}

module.exports = BaseProvider;
