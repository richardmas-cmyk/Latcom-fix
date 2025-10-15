const axios = require('axios');
const BaseProvider = require('./base-provider');
const http = require('http');
const https = require('https');

/**
 * Latcom Provider Implementation - OPTIMIZED
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

        // OPTIMIZATION: HTTP Keep-Alive agents for connection reuse
        // Reuse TCP connections instead of creating new ones for each request
        this.httpAgent = new http.Agent({
            keepAlive: true,
            keepAliveMsecs: 30000, // Keep connection alive for 30 seconds
            maxSockets: 50, // Max concurrent connections
            maxFreeSockets: 10 // Keep up to 10 idle sockets ready
        });

        this.httpsAgent = new https.Agent({
            keepAlive: true,
            keepAliveMsecs: 30000,
            maxSockets: 50,
            maxFreeSockets: 10
        });

        // Create axios instance with persistent configuration
        this.axiosInstance = axios.create({
            httpAgent: this.httpAgent,
            httpsAgent: this.httpsAgent,
            timeout: 30000,
            headers: {
                'Content-Type': 'application/json',
                'Connection': 'keep-alive'
            }
        });

        if (this.isConfigured) {
            console.log('✅ Latcom provider configured:', this.config.baseUrl);
            // OPTIMIZATION: Pre-authenticate on startup (fire-and-forget)
            this.login().catch(err => console.log('⚠️  Pre-auth failed:', err.message));
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

            // OPTIMIZATION: Use persistent axios instance with keep-alive
            const response = await this.axiosInstance.post(
                `${this.config.baseUrl}/api/dislogin`,
                {
                    username: this.config.username,
                    password: this.config.password,
                    dist_api: this.config.distApi,
                    user_uid: this.config.userUid
                }
            );

            if (response.data && response.data.access) {
                this.accessToken = response.data.access;
                // OPTIMIZATION: Extend token cache to 8 minutes (was 4)
                // Reduces re-authentication frequency
                this.tokenExpiry = Date.now() + (8 * 60 * 1000);
                console.log('✅ [Latcom] Login successful (token valid for 8min)');

                // OPTIMIZATION: Schedule proactive token refresh at 7 minutes
                // This ensures we always have a fresh token ready
                setTimeout(() => {
                    this.login().catch(err => console.log('⚠️  Token refresh failed:', err.message));
                }, 7 * 60 * 1000);

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
            const { phone, amount, reference, currency = 'USD', country = 'MEXICO' } = transaction;

            // Strip country code 52 if present
            const cleanPhone = phone.replace(/^\+?52/, '');

            console.log(`📞 [Latcom] Processing topup: ${cleanPhone} - ${amount} ${currency}`);

            // LATCOM MODE SWITCHER
            // Control behavior via LATCOM_MODE environment variable
            // Modes: RAW, VAT_ADJUSTED, HYBRID
            const LATCOM_MODE = process.env.LATCOM_MODE || 'HYBRID';
            const VAT_RATE = 0.16;
            let productId;
            let amountToSend;

            console.log(`🔧 [Latcom] Mode: ${LATCOM_MODE}`);

            if (LATCOM_MODE === 'RAW') {
                // RAW MODE: Use XOOM if available, otherwise open range - always send exact amount
                const xoomAmounts = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 150, 200, 300, 500];
                amountToSend = amount;

                if (xoomAmounts.includes(amount)) {
                    // XOOM product available
                    productId = `XOOM_${amount}_MXN`;
                    console.log(`📤 [Latcom] RAW MODE - XOOM product`);
                    console.log(`   Product: ${productId} (fixed)`);
                    console.log(`   Sending: ${amountToSend} MXN (no adjustment)`);
                } else {
                    // Use open range for non-standard amounts
                    productId = "TFE_MXN_20_TO_2000";
                    console.log(`📤 [Latcom] RAW MODE - Open range product`);
                    console.log(`   Product: ${productId} (open range)`);
                    console.log(`   Sending: ${amountToSend} MXN (no adjustment)`);
                }

            } else if (LATCOM_MODE === 'XOOM_ONLY') {
                // XOOM_ONLY MODE: Force XOOM product if it exists
                const xoomAmounts = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 150, 200, 300, 500];
                if (xoomAmounts.includes(amount)) {
                    productId = `XOOM_${amount}_MXN`;
                    amountToSend = amount;
                    console.log(`📦 [Latcom] XOOM_ONLY MODE - Using XOOM fixed product`);
                    console.log(`   Product: ${productId}`);
                    console.log(`   Sending: ${amountToSend} MXN`);
                } else {
                    throw new Error(`No XOOM product for ${amount} MXN. Available: 10,20,30,40,50,60,70,80,90,100,150,200,300,500`);
                }

            } else if (LATCOM_MODE === 'VAT_ADJUSTED') {
                // VAT ADJUSTED MODE: Always apply formula, always open range
                productId = "TFE_MXN_20_TO_2000";
                amountToSend = parseFloat((amount / (1 + VAT_RATE)).toFixed(2));
                console.log(`💱 [Latcom] VAT ADJUSTED MODE`);
                console.log(`   Customer wants: ${amount} MXN`);
                console.log(`   Formula: ${amount} / 1.16 = ${amountToSend} MXN`);
                console.log(`   Latcom adds 16%: ${amountToSend} × 1.16 = ${(amountToSend * 1.16).toFixed(2)} MXN`);
                console.log(`   Product: ${productId} (open range)`);

            } else if (LATCOM_MODE === 'HYBRID') {
                // HYBRID MODE: XOOM for 10,20 + VAT adjustment for 30+
                const xoomAmounts = [10, 20];

                if (xoomAmounts.includes(amount)) {
                    productId = `XOOM_${amount}_MXN`;
                    amountToSend = amount;
                    console.log(`✅ [Latcom] HYBRID MODE - XOOM fixed product`);
                    console.log(`   Product: ${productId}`);
                    console.log(`   Sending: ${amountToSend} MXN (no adjustment)`);
                } else if (amount >= 30) {
                    productId = "TFE_MXN_20_TO_2000";
                    amountToSend = parseFloat((amount / (1 + VAT_RATE)).toFixed(2));
                    console.log(`💱 [Latcom] HYBRID MODE - Open range with VAT adjustment`);
                    console.log(`   Formula: ${amount} / 1.16 = ${amountToSend} MXN`);
                    console.log(`   Product: ${productId} (open range)`);
                } else {
                    throw new Error(`Amount ${amount} MXN not supported in HYBRID mode. Use 10, 20, or 30+ MXN`);
                }

            } else {
                throw new Error(`Invalid LATCOM_MODE: ${LATCOM_MODE}. Use RAW, VAT_ADJUSTED, or HYBRID`);
            }

            const requestBody = {
                targetMSISDN: cleanPhone,
                dist_transid: reference || 'RLR' + Date.now(),
                operator: "TELEFONICA",
                country: country,
                currency: currency,
                amount: amountToSend,
                productId: productId,
                skuID: "0",
                service: 2
            };

            // OPTIMIZATION: Use persistent axios instance with keep-alive
            const response = await this.axiosInstance.post(
                `${this.config.baseUrl}/api/tn/fast`,
                requestBody,
                {
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`
                    }
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
