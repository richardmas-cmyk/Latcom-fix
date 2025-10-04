const axios = require('axios');

/**
 * Latcom API Integration
 * Handles real phone top-ups via Latcom distributor API
 */

class LatcomAPI {
    constructor() {
        this.baseUrl = process.env.LATCOM_DIST_API;
        this.username = process.env.LATCOM_USERNAME;
        this.password = process.env.LATCOM_PASSWORD;
        this.userUid = process.env.LATCOM_USER_UID;
        this.distApi = process.env.LATCOM_API_KEY;
        this.accessToken = null;
        this.tokenExpiry = null;

        if (!this.baseUrl || !this.username || !this.password || !this.distApi) {
            console.log('⚠️ Latcom credentials not configured');
        } else {
            console.log('✅ Latcom API configured:', this.baseUrl);
        }
    }

    /**
     * Login to Latcom and get access token
     */
    async login() {
        try {
            console.log('🔐 Logging into Latcom...');

            const response = await axios.post(
                `${this.baseUrl}/api/dislogin`,
                {
                    username: this.username,
                    password: this.password,
                    dist_api: this.distApi,
                    user_uid: this.userUid
                },
                {
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    timeout: 30000
                }
            );

            if (response.data && response.data.access) {
                this.accessToken = response.data.access;
                // Token expires in 5 minutes typically, refresh before that
                this.tokenExpiry = Date.now() + (4 * 60 * 1000);
                console.log('✅ Latcom login successful');
                return true;
            } else {
                console.error('❌ Latcom login failed - no access token');
                return false;
            }
        } catch (error) {
            console.error('❌ Latcom login error:', error.message);
            return false;
        }
    }

    /**
     * Ensure we have a valid access token
     */
    async ensureAuthenticated() {
        if (!this.accessToken || Date.now() >= this.tokenExpiry) {
            return await this.login();
        }
        return true;
    }

    /**
     * Process a phone top-up via Latcom
     * @param {string} phone - Phone number to top up
     * @param {number} amount - Amount in MXN
     * @param {string} reference - Transaction reference
     * @returns {Promise<{success: boolean, operatorTransactionId: string, message: string}>}
     */
    async topup(phone, amount, reference) {
        if (!this.baseUrl || !this.username || !this.password) {
            throw new Error('Latcom API not configured');
        }

        // Ensure we're authenticated
        const authenticated = await this.ensureAuthenticated();
        if (!authenticated) {
            throw new Error('Failed to authenticate with Latcom');
        }

        try {
            // Strip country code 52 if present (Latcom expects 10-digit number only)
            let cleanPhone = phone.replace(/^\+?52/, '');

            console.log(`📞 Calling Latcom API for ${cleanPhone} (original: ${phone}) with $${amount}...`);

            // Latcom API format - open range 20-200 MXN
            const requestBody = {
                targetMSISDN: cleanPhone,
                dist_transid: reference || 'RLR' + Date.now(),
                operator: "TELEFONICA",
                country: "MEXICO",
                currency: "MXN",
                amount: amount,
                productId: "TFE_MXN_20_TO_2000",
                skuID: "0",
                service: 2
            };

            console.log('📤 Latcom request:', requestBody);

            const response = await axios.post(
                `${this.baseUrl}/api/tn/fast`,
                requestBody,
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.accessToken}`
                    },
                    timeout: 30000
                }
            );

            console.log('✅ Latcom response:', JSON.stringify(response.data));

            // Parse Latcom response (page 11-12)
            if (response.data && (response.data.status === 'Success' || response.data.status === 'SUCCESS')) {
                return {
                    success: true,
                    operatorTransactionId: response.data.transId || response.data.venTransid || 'LATCOM_' + Date.now(),
                    message: response.data.responseMessage || 'Top-up successful'
                };
            } else {
                return {
                    success: false,
                    operatorTransactionId: null,
                    message: response.data.vendorResponseMsg || response.data.responseMessage || response.data.status || 'Top-up failed'
                };
            }

        } catch (error) {
            console.error('❌ Latcom API error:', error.message);

            if (error.response) {
                console.error('❌ Response status:', error.response.status);
                console.error('❌ Response data:', JSON.stringify(error.response.data));

                const errorMessage = error.response.data?.vendorResponseMsg ||
                                    error.response.data?.responseMessage ||
                                    error.response.data?.message ||
                                    JSON.stringify(error.response.data) ||
                                    'Latcom API error';
                return {
                    success: false,
                    operatorTransactionId: null,
                    message: errorMessage
                };
            } else if (error.request) {
                throw new Error('Latcom API timeout - no response received');
            } else {
                throw new Error('Latcom API request failed: ' + error.message);
            }
        }
    }

    /**
     * Phone number lookup - identify carrier
     */
    async lookupPhone(phoneNumber) {
        try {
            await this.ensureAuthenticated();

            console.log(`🔍 Looking up phone number: ${phoneNumber}`);

            // Latcom doesn't have a dedicated lookup endpoint
            // We'll return basic info based on phone pattern
            const cleanPhone = phoneNumber.replace(/^\+?52/, '');

            // Mexican phone number patterns (basic detection)
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
                note: 'Carrier detection based on area code pattern'
            };

        } catch (error) {
            console.error('❌ Phone lookup error:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get transaction status from Latcom
     */
    async getTransactionStatus(operatorTransactionId) {
        try {
            await this.ensureAuthenticated();

            console.log(`📊 Checking transaction status: ${operatorTransactionId}`);

            const response = await axios.get(
                `${this.baseUrl}/api/transaction/${operatorTransactionId}`,
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
                status: response.data
            };

        } catch (error) {
            console.error('❌ Transaction status error:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get available products/SKUs from Latcom
     */
    async getProducts() {
        try {
            await this.ensureAuthenticated();

            console.log('📦 Fetching Latcom products...');

            const response = await axios.get(
                `${this.baseUrl}/api/products`,
                {
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: 30000
                }
            );

            return {
                success: true,
                products: response.data
            };

        } catch (error) {
            console.error('❌ Get products error:', error.message);

            if (error.response) {
                console.error('Response:', JSON.stringify(error.response.data));
            }

            return {
                success: false,
                error: error.message,
                response: error.response?.data
            };
        }
    }

    /**
     * Get product catalog from Latcom
     */
    async getCatalog() {
        try {
            await this.ensureAuthenticated();

            console.log('📋 Fetching Latcom catalog...');

            const response = await axios.get(
                `${this.baseUrl}/api/catalog`,
                {
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: 30000
                }
            );

            return {
                success: true,
                catalog: response.data
            };

        } catch (error) {
            console.error('❌ Get catalog error:', error.message);

            return {
                success: false,
                error: error.message,
                response: error.response?.data
            };
        }
    }

    /**
     * Test a product with a phone number
     * @param {string} phone - Phone number to test
     * @param {object} product - Product object from catalog
     */
    async testProduct(phone, product) {
        if (!this.baseUrl || !this.username || !this.password) {
            throw new Error('Latcom API not configured');
        }

        // Ensure we're authenticated
        const authenticated = await this.ensureAuthenticated();
        if (!authenticated) {
            throw new Error('Failed to authenticate with Latcom');
        }

        try {
            // Strip country code 52 if present
            let cleanPhone = phone.replace(/^\\+?52/, '');

            console.log(`📞 Testing product ${product.productId} for ${cleanPhone}...`);

            const requestBody = {
                targetMSISDN: cleanPhone,
                dist_transid: 'TEST_' + Date.now(),
                operator: "TELEFONICA",
                country: "MEXICO",
                currency: product.currency,
                amount: product.amount,
                productId: product.productId,
                skuID: product.skuId,
                service: product.service
            };

            console.log('📤 Test request:', requestBody);

            const response = await axios.post(
                `${this.baseUrl}/api/tn/fast`,
                requestBody,
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.accessToken}`
                    },
                    timeout: 30000
                }
            );

            console.log('✅ Test response:', JSON.stringify(response.data));

            if (response.data && (response.data.status === 'Success' || response.data.status === 'SUCCESS')) {
                return {
                    success: true,
                    productId: product.productId,
                    operatorTransactionId: response.data.transId || response.data.venTransid,
                    message: response.data.responseMessage || 'Test successful',
                    data: response.data
                };
            } else {
                return {
                    success: false,
                    productId: product.productId,
                    message: response.data.vendorResponseMsg || response.data.responseMessage || 'Test failed',
                    data: response.data
                };
            }

        } catch (error) {
            console.error('❌ Test product error:', error.message);

            if (error.response) {
                console.error('❌ Response:', JSON.stringify(error.response.data));
                return {
                    success: false,
                    productId: product.productId,
                    message: error.response.data?.vendorResponseMsg || error.response.data?.message || 'API error',
                    error: error.response.data
                };
            } else {
                throw error;
            }
        }
    }

    /**
     * Check if Latcom API is configured
     */
    isConfigured() {
        return !!(this.baseUrl && this.username && this.password);
    }
}

module.exports = new LatcomAPI();
