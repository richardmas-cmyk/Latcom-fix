const axios = require('axios');

/**
 * Latcom API Integration
 * Handles real phone top-ups via Latcom distributor API
 */

class LatcomAPI {
    constructor() {
        this.apiUrl = process.env.LATCOM_DIST_API;
        this.username = process.env.LATCOM_USERNAME;
        this.password = process.env.LATCOM_PASSWORD;
        this.userUid = process.env.LATCOM_USER_UID;

        if (!this.apiUrl || !this.username || !this.password) {
            console.log('⚠️ Latcom credentials not configured');
        } else {
            console.log('✅ Latcom API configured:', this.apiUrl);
        }
    }

    /**
     * Process a phone top-up via Latcom
     * @param {string} phone - Phone number to top up
     * @param {number} amount - Amount in MXN
     * @param {string} reference - Transaction reference
     * @returns {Promise<{success: boolean, operatorTransactionId: string, message: string}>}
     */
    async topup(phone, amount, reference) {
        if (!this.apiUrl || !this.username || !this.password) {
            throw new Error('Latcom API not configured');
        }

        try {
            console.log(`📞 Calling Latcom API for ${phone} with $${amount}...`);

            // Latcom API format (from documentation)
            const requestBody = {
                targetMSISDN: phone,
                dist_transid: reference || 'RLR' + Date.now(),
                operator: "TELEFONICA",
                country: "MEXICO",
                currency: "USD",
                amount: amount,
                productId: "TFE_MEXICO_TOPUP_103_2579_MXN",
                skuID: "0",
                service: 2
            };

            console.log('📤 Latcom request:', requestBody);

            const response = await axios.post(
                this.apiUrl,
                requestBody,
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'dist_api': process.env.LATCOM_API_KEY || ''
                    },
                    timeout: 30000 // 30 second timeout
                }
            );

            console.log('✅ Latcom response:', JSON.stringify(response.data));

            // Parse Latcom response
            if (response.data && (response.data.success || response.data.status === 'success' || response.data.responseCode === '0')) {
                return {
                    success: true,
                    operatorTransactionId: response.data.transactionId || response.data.referenceId || response.data.id || 'LATCOM_' + Date.now(),
                    message: response.data.message || 'Top-up successful'
                };
            } else {
                return {
                    success: false,
                    operatorTransactionId: null,
                    message: response.data.message || response.data.error || response.data.responseMessage || 'Top-up failed'
                };
            }

        } catch (error) {
            console.error('❌ Latcom API error:', error.message);

            if (error.response) {
                console.error('❌ Response data:', error.response.data);
                // API returned error response
                return {
                    success: false,
                    operatorTransactionId: null,
                    message: error.response.data?.message || error.response.data?.error || error.response.data?.responseMessage || 'Latcom API error'
                };
            } else if (error.request) {
                // No response received
                throw new Error('Latcom API timeout - no response received');
            } else {
                // Request setup error
                throw new Error('Latcom API request failed: ' + error.message);
            }
        }
    }

    /**
     * Check if Latcom API is configured
     */
    isConfigured() {
        return !!(this.apiUrl && this.username && this.password);
    }
}

module.exports = new LatcomAPI();
