const axios = require('axios');
const BaseProvider = require('./base-provider');

/**
 * Latcom Provider Implementation
 * Supports: Mexico topups (Telefonica/Movistar)
 */
class LatcomProvider extends BaseProvider {
    constructor() {
        super('Latcom', {
            baseUrl: process.env.LATCOM_DIST_API,
            username: process.env.LATCOM_USERNAME,
            password: process.env.LATCOM_PASSWORD,
            userUid: process.env.LATCOM_USER_UID,
            distApi: process.env.LATCOM_API_KEY
        });

        this.accessToken = null;
        this.tokenExpiry = null;

        this.isConfigured = !!(this.config.baseUrl && this.config.username &&
                               this.config.password && this.config.distApi);

        if (this.isConfigured) {
            console.log('✅ Latcom provider configured:', this.config.baseUrl);
        } else {
            console.log('⚠️  Latcom provider not configured');
        }
    }

    getCapabilities() {
        return {
            topups: true,
            billPayments: false,
            vouchers: false,
            countries: ['MEXICO'],
            operators: ['TELEFONICA', 'MOVISTAR'],
            currencies: ['MXN']
        };
    }

    async login() {
        try {
            console.log('🔐 [Latcom] Logging in...');

            const response = await axios.post(
                `${this.config.baseUrl}/api/dislogin`,
                {
                    username: this.config.username,
                    password: this.config.password,
                    dist_api: this.config.distApi,
                    user_uid: this.config.userUid
                },
                {
                    headers: { 'Content-Type': 'application/json' },
                    timeout: 30000
                }
            );

            if (response.data && response.data.access) {
                this.accessToken = response.data.access;
                this.tokenExpiry = Date.now() + (4 * 60 * 1000); // 4 minutes
                console.log('✅ [Latcom] Login successful');
                return true;
            }

            console.error('❌ [Latcom] Login failed - no access token');
            return false;
        } catch (error) {
            console.error('❌ [Latcom] Login error:', error.message);
            return false;
        }
    }

    async ensureAuthenticated() {
        if (!this.accessToken || Date.now() >= this.tokenExpiry) {
            return await this.login();
        }
        return true;
    }

    async topup(transaction) {
        const startTime = Date.now();

        if (!this.isConfigured) {
            throw new Error('Latcom provider not configured');
        }

        const authenticated = await this.ensureAuthenticated();
        if (!authenticated) {
            throw new Error('Failed to authenticate with Latcom');
        }

        try {
            const { phone, amount, reference, currency = 'MXN', country = 'MEXICO' } = transaction;

            // Strip country code 52 if present
            const cleanPhone = phone.replace(/^\+?52/, '');

            console.log(`📞 [Latcom] Processing topup: ${cleanPhone} - ${amount} ${currency}`);

            // LATCOM 16% MARKUP ADJUSTMENT
            // Latcom adds 16% markup, so we send LESS to ensure customer gets exact amount
            // Example: Customer wants 30 MXN → We send 25.86 MXN → Latcom delivers 30.00 MXN
            const LATCOM_MARKUP = 1.16; // 16% markup
            const adjustedAmount = parseFloat((amount / LATCOM_MARKUP).toFixed(2));

            console.log(`💱 [Latcom] Adjusting for 16% markup: ${amount} MXN → ${adjustedAmount} MXN (send amount)`);
            console.log(`   Customer will receive: ${adjustedAmount} × ${LATCOM_MARKUP} = ${(adjustedAmount * LATCOM_MARKUP).toFixed(2)} MXN`);

            // Always use open range product for precise control
            const productId = "TFE_MXN_20_TO_2000";
            console.log(`✅ [Latcom] Using open range product: ${productId}`);

            const requestBody = {
                targetMSISDN: cleanPhone,
                dist_transid: reference || 'RLR' + Date.now(),
                operator: "TELEFONICA",
                country: country,
                currency: currency,
                amount: adjustedAmount,  // Send adjusted amount (16% less)
                productId: productId,
                skuID: "0",
                service: 2
            };

            const response = await axios.post(
                `${this.config.baseUrl}/api/tn/fast`,
                requestBody,
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.accessToken}`
                    },
                    timeout: 30000
                }
            );

            const responseTime = Date.now() - startTime;

            if (response.data && (response.data.status === 'Success' || response.data.status === 'SUCCESS')) {
                return {
                    success: true,
                    provider: 'Latcom',
                    providerTransactionId: response.data.transId || response.data.venTransid,
                    message: response.data.responseMessage || 'Top-up successful',
                    responseTime: responseTime,
                    rawResponse: response.data
                };
            } else {
                return {
                    success: false,
                    provider: 'Latcom',
                    providerTransactionId: null,
                    message: response.data.vendorResponseMsg || response.data.responseMessage || 'Top-up failed',
                    responseTime: responseTime,
                    rawResponse: response.data
                };
            }

        } catch (error) {
            const responseTime = Date.now() - startTime;
            console.error('❌ [Latcom] Topup error:', error.message);

            if (error.response) {
                const errorMessage = error.response.data?.vendorResponseMsg ||
                                    error.response.data?.responseMessage ||
                                    error.response.data?.message ||
                                    'Latcom API error';
                return {
                    success: false,
                    provider: 'Latcom',
                    providerTransactionId: null,
                    message: errorMessage,
                    responseTime: responseTime,
                    error: error.response.data
                };
            }

            throw error;
        }
    }

    async lookupPhone(phone) {
        try {
            await this.ensureAuthenticated();

            const cleanPhone = phone.replace(/^\+?52/, '');

            // Mexican phone number pattern detection
            let carrier = 'Unknown';
            if (cleanPhone.startsWith('55') || cleanPhone.startsWith('56')) {
                carrier = 'TELEFONICA (Movistar)';
            } else if (cleanPhone.startsWith('33')) {
                carrier = 'TELCEL';
            } else if (cleanPhone.startsWith('81')) {
                carrier = 'AT&T / TELCEL (Monterrey)';
            }

            return {
                success: true,
                phone: cleanPhone,
                formatted: '+52' + cleanPhone,
                carrier: carrier,
                country: 'Mexico',
                valid: cleanPhone.length === 10,
                provider: 'Latcom'
            };

        } catch (error) {
            console.error('❌ [Latcom] Phone lookup error:', error.message);
            return {
                success: false,
                error: error.message,
                provider: 'Latcom'
            };
        }
    }

    async getTransactionStatus(providerTransactionId) {
        try {
            await this.ensureAuthenticated();

            const response = await axios.get(
                `${this.config.baseUrl}/api/transaction/${providerTransactionId}`,
                {
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: 10000
                }
            );

            return {
                success: true,
                status: response.data,
                provider: 'Latcom'
            };

        } catch (error) {
            console.error('❌ [Latcom] Transaction status error:', error.message);
            return {
                success: false,
                error: error.message,
                provider: 'Latcom'
            };
        }
    }

    async getProducts(country = null) {
        const { getAllProducts } = require('../products');
        const products = getAllProducts();

        return products.map(p => ({
            ...p,
            provider: 'Latcom',
            country: 'MEXICO'
        }));
    }
}

module.exports = LatcomProvider;
