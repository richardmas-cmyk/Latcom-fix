const axios = require('axios');
const BaseProvider = require('./base-provider');

/**
 * PPN (Valuetop) Provider Implementation
 * Supports: Global topups (107 countries, 133 operators), gift cards, bill payments
 */
class PPNProvider extends BaseProvider {
    constructor() {
        super('PPN', {
            baseUrl: process.env.PPN_BASE_URL,
            username: process.env.PPN_USERNAME,
            environment: process.env.PPN_ENVIRONMENT || 'sandbox'
        });

        // PPN uses IP whitelisting, not password authentication
        this.isConfigured = !!(this.config.baseUrl && this.config.username);

        if (this.isConfigured) {
            console.log(`✅ PPN provider configured: ${this.config.baseUrl} (${this.config.environment}) - IP whitelisting`);
        } else {
            console.log('⚠️  PPN provider not configured - missing base URL or username');
        }
    }

    getCapabilities() {
        return {
            topups: true,
            billPayments: true,
            vouchers: true,
            giftCards: true,
            countries: ['US', 'MX', 'JM', 'IN', 'NG', 'BR', 'CO', 'AR', /* 107 total */],
            operators: ['Telcel', 'AT&T', 'Movistar', 'T-Mobile', 'Verizon', /* 133 total */],
            currencies: ['USD', 'MXN', 'INR', 'NGN', 'BRL', /* many more */],
            totalSkus: 964
        };
    }

    /**
     * Generate Basic Auth header
     */
    getAuthHeader() {
        const credentials = `${this.config.username}:${this.config.password}`;
        const base64Credentials = Buffer.from(credentials).toString('base64');
        return `Basic ${base64Credentials}`;
    }

    async topup(transaction) {
        const startTime = Date.now();

        if (!this.isConfigured) {
            throw new Error('PPN provider not configured');
        }

        try {
            const { phone, amount, skuId, reference, operator } = transaction;

            // PPN requires either a SKU ID or operator information
            if (!skuId && !operator) {
                console.log(`⚠️  [PPN] SKU ID required for PPN topups`);
                return {
                    success: false,
                    provider: 'PPN',
                    providerTransactionId: null,
                    message: 'PPN requires SKU ID - use operator lookup or product catalog',
                    responseTime: Date.now() - startTime
                };
            }

            console.log(`📞 [PPN] Processing topup: ${phone} - ${amount} - SKU: ${skuId || operator}`);

            const requestBody = {
                skuId: skuId,
                mobile: phone,
                amount: amount,
                correlationId: reference || `RLR_${Date.now()}`
            };

            // Optional: specify transaction currency (defaults to wallet currency)
            // requestBody.transactionCurrencyCode = 'MXN';

            const response = await axios.post(
                `${this.config.baseUrl}/transaction/topup`,
                requestBody,
                {
                    headers: {
                        'Authorization': this.getAuthHeader(),
                        'Content-Type': 'application/json'
                    },
                    timeout: 30000
                }
            );

            const responseTime = Date.now() - startTime;

            // PPN success: HTTP 200 + responseCode "000"
            if (response.data && response.data.responseCode === '000') {
                const payload = response.data.payLoad;
                return {
                    success: true,
                    provider: 'PPN',
                    providerTransactionId: payload?.valuetopupTransactionId || payload?.transactionId,
                    message: response.data.responseMessage || 'Top-up successful',
                    responseTime: responseTime,
                    responseCode: response.data.responseCode,
                    operatorTransactionId: payload?.operatorTransactionId,
                    totalCost: payload?.transactionAmount,
                    deliveredAmount: payload?.localCurrencyAmountExcludingTax,
                    rawResponse: response.data
                };
            } else {
                return {
                    success: false,
                    provider: 'PPN',
                    providerTransactionId: null,
                    message: response.data?.responseMessage || 'Transaction failed',
                    responseTime: responseTime,
                    responseCode: response.data?.responseCode,
                    rawResponse: response.data
                };
            }

        } catch (error) {
            const responseTime = Date.now() - startTime;
            console.error('❌ [PPN] Topup error:', error.message);

            if (error.response) {
                return {
                    success: false,
                    provider: 'PPN',
                    providerTransactionId: null,
                    message: error.response.data?.error || 'PPN API error',
                    responseTime: responseTime,
                    error: error.response.data
                };
            }

            throw error;
        }
    }

    async billPayment(payment) {
        const startTime = Date.now();

        if (!this.isConfigured) {
            throw new Error('PPN provider not configured');
        }

        try {
            const { skuId, accountNumber, amount, reference } = payment;

            console.log(`💳 [PPN] Processing bill payment: Account ${accountNumber} - ${amount}`);

            const requestBody = {
                skuId: skuId,
                accountNumber: accountNumber,
                amount: amount
            };

            if (reference) {
                requestBody.reference = reference;
            }

            const response = await axios.post(
                `${this.config.baseUrl}/billpay`,
                requestBody,
                {
                    headers: {
                        'Authorization': this.getAuthHeader(),
                        'Content-Type': 'application/json'
                    },
                    timeout: 30000
                }
            );

            const responseTime = Date.now() - startTime;

            if (response.data && response.data.success) {
                return {
                    success: true,
                    provider: 'PPN',
                    providerTransactionId: response.data.transactionId,
                    message: response.data.message || 'Bill payment successful',
                    responseTime: responseTime,
                    rawResponse: response.data
                };
            } else {
                return {
                    success: false,
                    provider: 'PPN',
                    providerTransactionId: null,
                    message: response.data?.error || 'Bill payment failed',
                    responseTime: responseTime,
                    rawResponse: response.data
                };
            }

        } catch (error) {
            const responseTime = Date.now() - startTime;
            console.error('❌ [PPN] Bill payment error:', error.message);

            if (error.response) {
                return {
                    success: false,
                    provider: 'PPN',
                    providerTransactionId: null,
                    message: error.response.data?.error || 'PPN API error',
                    responseTime: responseTime,
                    error: error.response.data
                };
            }

            throw error;
        }
    }

    async purchaseVoucher(voucher) {
        const startTime = Date.now();

        if (!this.isConfigured) {
            throw new Error('PPN provider not configured');
        }

        try {
            const { skuId, amount, recipientEmail, reference } = voucher;

            console.log(`🎁 [PPN] Purchasing gift card/voucher: SKU ${skuId} - ${amount}`);

            const requestBody = {
                skuId: skuId,
                amount: amount
            };

            if (recipientEmail) {
                requestBody.recipientEmail = recipientEmail;
            }

            if (reference) {
                requestBody.reference = reference;
            }

            const response = await axios.post(
                `${this.config.baseUrl}/giftcard`,
                requestBody,
                {
                    headers: {
                        'Authorization': this.getAuthHeader(),
                        'Content-Type': 'application/json'
                    },
                    timeout: 30000
                }
            );

            const responseTime = Date.now() - startTime;

            if (response.data && response.data.success) {
                return {
                    success: true,
                    provider: 'PPN',
                    providerTransactionId: response.data.transactionId,
                    message: response.data.message || 'Voucher purchased successfully',
                    pins: response.data.pins || [],
                    responseTime: responseTime,
                    rawResponse: response.data
                };
            } else {
                return {
                    success: false,
                    provider: 'PPN',
                    providerTransactionId: null,
                    message: response.data?.error || 'Voucher purchase failed',
                    responseTime: responseTime,
                    rawResponse: response.data
                };
            }

        } catch (error) {
            const responseTime = Date.now() - startTime;
            console.error('❌ [PPN] Voucher purchase error:', error.message);

            if (error.response) {
                return {
                    success: false,
                    provider: 'PPN',
                    providerTransactionId: null,
                    message: error.response.data?.error || 'PPN API error',
                    responseTime: responseTime,
                    error: error.response.data
                };
            }

            throw error;
        }
    }

    async getProducts(country = null) {
        try {
            let url = `${this.config.baseUrl}/products`;
            if (country) {
                url += `?country=${country}`;
            }

            const response = await axios.get(url, {
                headers: {
                    'Authorization': this.getAuthHeader(),
                    'Content-Type': 'application/json'
                },
                timeout: 10000
            });

            if (response.data && response.data.success) {
                return response.data.products.map(p => ({
                    ...p,
                    provider: 'PPN'
                }));
            }

            return [];

        } catch (error) {
            console.error('❌ [PPN] Get products error:', error.message);
            return [];
        }
    }

    async getSKUs(filters = {}) {
        try {
            const params = new URLSearchParams();
            if (filters.country) params.append('country', filters.country);
            if (filters.type) params.append('type', filters.type);
            if (filters.provider) params.append('provider', filters.provider);

            const url = `${this.config.baseUrl}/skus?${params.toString()}`;

            const response = await axios.get(url, {
                headers: {
                    'Authorization': this.getAuthHeader(),
                    'Content-Type': 'application/json'
                },
                timeout: 10000
            });

            if (response.data && response.data.success) {
                return {
                    success: true,
                    totalSkus: response.data.totalSkus,
                    skus: response.data.skus.map(sku => ({
                        ...sku,
                        provider: 'PPN'
                    }))
                };
            }

            return { success: false, skus: [] };

        } catch (error) {
            console.error('❌ [PPN] Get SKUs error:', error.message);
            return { success: false, error: error.message, skus: [] };
        }
    }

    async checkBalance() {
        try {
            const response = await axios.get(
                `${this.config.baseUrl}/balance`,
                {
                    headers: {
                        'Authorization': this.getAuthHeader(),
                        'Content-Type': 'application/json'
                    },
                    timeout: 10000
                }
            );

            if (response.data && response.data.success) {
                return {
                    success: true,
                    balance: response.data.balance.balance,
                    currency: response.data.currency || 'USD',
                    customer: response.data.customer,
                    provider: 'PPN'
                };
            }

            return { success: false, provider: 'PPN' };

        } catch (error) {
            console.error('❌ [PPN] Check balance error:', error.message);
            return {
                success: false,
                error: error.message,
                provider: 'PPN'
            };
        }
    }

    async getTransactionStatus(providerTransactionId) {
        try {
            const response = await axios.get(
                `${this.config.baseUrl}/transaction/${providerTransactionId}`,
                {
                    headers: {
                        'Authorization': this.getAuthHeader(),
                        'Content-Type': 'application/json'
                    },
                    timeout: 10000
                }
            );

            if (response.data && response.data.success) {
                return {
                    success: true,
                    status: response.data.status,
                    details: response.data.details,
                    provider: 'PPN'
                };
            }

            return { success: false, provider: 'PPN' };

        } catch (error) {
            console.error('❌ [PPN] Transaction status error:', error.message);
            return {
                success: false,
                error: error.message,
                provider: 'PPN'
            };
        }
    }
}

module.exports = PPNProvider;
