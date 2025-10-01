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

            // Latcom API format (from documentation page 8-9)
            const requestBody = {
                targetMSISDN: cleanPhone,
                dist_transid: reference || 'RLR' + Date.now(),
                operator: "TELEFONICA",
                country: "MEXICO",
                currency: "MXN",
                amount: amount,
                productId: "TFE_MEXICO_TOPUP_103_2579_MXN",
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
     * Check if Latcom API is configured
     */
    isConfigured() {
        return !!(this.baseUrl && this.username && this.password);
    }
}

module.exports = new LatcomAPI();
