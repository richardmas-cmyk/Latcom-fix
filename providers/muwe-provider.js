const axios = require('axios');
const crypto = require('crypto');
const BaseProvider = require('./base-provider');

/**
 * MUWE Provider Implementation
 * Supports: Bill payments, mobile topups, SPEI transfers, OXXO cash payments
 *
 * Services:
 * - Bill Payment API: Pay bills and mobile topups (100+ billers)
 * - SPEI API: Bank transfers (pay-in/pay-out)
 * - OXXO API: Cash collection at OXXO stores
 */
class MUWEProvider extends BaseProvider {
    constructor() {
        super('MUWE', {
            baseUrl: process.env.MUWE_BASE_URL || 'https://test.sipelatam.mx',
            merCode: process.env.MUWE_MER_CODE,
            appId: process.env.MUWE_APP_ID,
            mchId: process.env.MUWE_MCH_ID,
            secretKey: process.env.MUWE_SECRET_KEY || 'ZtIPVopZCwxLiJgrs68MPgNOorWx9CzT',
            environment: process.env.MUWE_ENVIRONMENT || 'test'
        });

        this.isConfigured = !!(this.config.baseUrl && this.config.merCode && this.config.secretKey);

        if (this.isConfigured) {
            console.log(`✅ MUWE provider configured: ${this.config.baseUrl} (${this.config.environment})`);
        } else {
            console.log('⚠️  MUWE provider not configured - missing credentials');
        }
    }

    getCapabilities() {
        return {
            topups: true,
            billPayments: true,
            vouchers: false,
            spei: true,
            oxxo: true,
            countries: ['MX'],
            operators: ['Telcel', 'AT&T', 'Movistar', 'Unefon', 'Virgin Mobile'],
            currencies: ['MXN'],
            billers: 100, // 100+ bill payment companies
            features: ['mobile_topups', 'bill_payments', 'spei_transfers', 'oxxo_cash']
        };
    }

    /**
     * Generate MD5 signature for MUWE API
     * Algorithm:
     * 1. Sort params alphabetically by key
     * 2. Create key=value&key2=value2 string (exclude empty values and 'sign')
     * 3. Append &key=SECRET_KEY
     * 4. MD5 hash and convert to uppercase
     */
    generateSignature(params) {
        // Remove sign field if present and filter out empty values
        const filteredParams = {};
        for (const [key, value] of Object.entries(params)) {
            if (key !== 'sign' && value !== null && value !== undefined && value !== '') {
                filteredParams[key] = value;
            }
        }

        // Sort keys alphabetically
        const sortedKeys = Object.keys(filteredParams).sort();

        // Build string: key1=value1&key2=value2...
        const stringA = sortedKeys
            .map(key => `${key}=${filteredParams[key]}`)
            .join('&');

        // Append secret key
        const stringSignTemp = `${stringA}&key=${this.config.secretKey}`;

        // MD5 hash and uppercase
        const sign = crypto.createHash('md5').update(stringSignTemp).digest('hex').toUpperCase();

        console.log(`[MUWE] Signature string: ${stringSignTemp.substring(0, 100)}...`);
        console.log(`[MUWE] Generated signature: ${sign}`);

        return sign;
    }

    /**
     * Generate random nonce string
     */
    generateNonce() {
        return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    }

    /**
     * Make authenticated request to MUWE API
     */
    async makeRequest(method, path, data = null, headers = {}) {
        const url = `${this.config.baseUrl}${path}`;

        try {
            const config = {
                method: method,
                url: url,
                headers: {
                    'Content-Type': 'application/json',
                    ...headers
                },
                timeout: 60000
            };

            if (data && (method === 'POST' || method === 'PUT')) {
                config.data = data;
            }

            const response = await axios(config);
            return response.data;

        } catch (error) {
            if (error.response) {
                console.error('[MUWE] API Error:', error.response.status, error.response.data);
                throw new Error(`MUWE API error: ${error.response.data?.message || error.response.statusText}`);
            }
            throw error;
        }
    }

    /**
     * Mobile topup (using Bill Payment API with payType: 103)
     */
    async topup(transaction) {
        const startTime = Date.now();

        if (!this.isConfigured) {
            throw new Error('MUWE provider not configured');
        }

        try {
            const { phone, amount, reference, companySku } = transaction;

            console.log(`📞 [MUWE] Processing topup: ${phone} - ${amount} MXN`);

            // MUWE requires companySku (operator SKU) for topups
            if (!companySku) {
                return {
                    success: false,
                    provider: 'MUWE',
                    providerTransactionId: null,
                    message: 'MUWE requires companySku (operator SKU) for topups',
                    responseTime: Date.now() - startTime
                };
            }

            const orderNo = reference || `RLR_TOPUP_${Date.now()}`;
            const nonceStr = Date.now().toString();

            const requestBody = {
                merCode: parseInt(this.config.merCode),
                serviceNumber: phone,
                amount: amount,
                payType: 103, // 103 = topups
                orderNo: orderNo,
                companySku: companySku,
                paymentMethod: 'CA', // Cash/Credit
                currency: 'MXN',
                nonceStr: nonceStr
            };

            // Generate signature
            requestBody.sign = this.generateSignature(requestBody);

            const response = await this.makeRequest('POST', '/serve/recharge/pay', requestBody);

            const responseTime = Date.now() - startTime;

            // Success: code === 200
            if (response.code === 200) {
                return {
                    success: true,
                    provider: 'MUWE',
                    providerTransactionId: response.data?.uid || response.data?.identifier,
                    message: 'Topup successful',
                    responseTime: responseTime,
                    responseCode: response.code,
                    externalId: response.data?.externalId,
                    processedAt: response.data?.processedAt,
                    rawResponse: response
                };
            } else {
                return {
                    success: false,
                    provider: 'MUWE',
                    providerTransactionId: null,
                    message: response.message || 'Topup failed',
                    responseTime: responseTime,
                    responseCode: response.code,
                    rawResponse: response
                };
            }

        } catch (error) {
            const responseTime = Date.now() - startTime;
            console.error('❌ [MUWE] Topup error:', error.message);

            return {
                success: false,
                provider: 'MUWE',
                providerTransactionId: null,
                message: error.message,
                responseTime: responseTime,
                error: error.message
            };
        }
    }

    /**
     * Bill payment (using Bill Payment API with payType: 101)
     */
    async billPayment(payment) {
        const startTime = Date.now();

        if (!this.isConfigured) {
            throw new Error('MUWE provider not configured');
        }

        try {
            const { accountNumber, amount, companySku, reference, posNumber } = payment;

            console.log(`💳 [MUWE] Processing bill payment: ${accountNumber} - ${amount} MXN`);

            if (!companySku) {
                return {
                    success: false,
                    provider: 'MUWE',
                    providerTransactionId: null,
                    message: 'MUWE requires companySku (biller SKU) for bill payments',
                    responseTime: Date.now() - startTime
                };
            }

            const orderNo = reference || `RLR_BILL_${Date.now()}`;
            const nonceStr = Date.now().toString();

            const requestBody = {
                merCode: parseInt(this.config.merCode),
                serviceNumber: accountNumber,
                amount: amount,
                payType: 101, // 101 = bill payment
                orderNo: orderNo,
                companySku: companySku,
                paymentMethod: 'CA',
                currency: 'MXN',
                nonceStr: nonceStr
            };

            if (posNumber) {
                requestBody.posNumber = posNumber;
            }

            // Generate signature
            requestBody.sign = this.generateSignature(requestBody);

            const response = await this.makeRequest('POST', '/serve/recharge/pay', requestBody);

            const responseTime = Date.now() - startTime;

            if (response.code === 200) {
                return {
                    success: true,
                    provider: 'MUWE',
                    providerTransactionId: response.data?.uid || response.data?.identifier,
                    message: 'Bill payment successful',
                    responseTime: responseTime,
                    responseCode: response.code,
                    billTotal: response.data?.billTotal,
                    externalId: response.data?.externalId,
                    processedAt: response.data?.processedAt,
                    rawResponse: response
                };
            } else {
                return {
                    success: false,
                    provider: 'MUWE',
                    providerTransactionId: null,
                    message: response.message || 'Bill payment failed',
                    responseTime: responseTime,
                    responseCode: response.code,
                    rawResponse: response
                };
            }

        } catch (error) {
            const responseTime = Date.now() - startTime;
            console.error('❌ [MUWE] Bill payment error:', error.message);

            return {
                success: false,
                provider: 'MUWE',
                providerTransactionId: null,
                message: error.message,
                responseTime: responseTime,
                error: error.message
            };
        }
    }

    /**
     * Get bill balance before payment
     */
    async checkBillBalance(accountNumber, companySku) {
        try {
            const orderNo = `RLR_CHK_${Date.now()}`;
            const nonceStr = Date.now().toString();

            const requestBody = {
                merCode: parseInt(this.config.merCode),
                serviceNumber: accountNumber,
                orderNo: orderNo,
                payType: 102, // 102 = query balance
                companySku: companySku,
                nonceStr: nonceStr
            };

            requestBody.sign = this.generateSignature(requestBody);

            const response = await this.makeRequest('POST', '/serve/recharge/checkBalance', requestBody);

            if (response.code === 200) {
                return {
                    success: true,
                    balance: response.data?.balance,
                    billTotal: response.data?.billTotal,
                    currency: response.data?.currency,
                    dueDate: response.data?.dueDate,
                    maxPaymentAmount: response.data?.maxPaymentAmount,
                    provider: 'MUWE'
                };
            }

            return {
                success: false,
                message: response.message,
                provider: 'MUWE'
            };

        } catch (error) {
            console.error('❌ [MUWE] Check bill balance error:', error.message);
            return {
                success: false,
                error: error.message,
                provider: 'MUWE'
            };
        }
    }

    /**
     * Get list of available bill companies
     */
    async getBillCompanies(payType = 101) {
        try {
            const nonceStr = Date.now().toString();

            const requestBody = {
                merCode: parseInt(this.config.merCode),
                payType: payType, // 101 = bills, 103 = topups
                nonceStr: nonceStr
            };

            requestBody.sign = this.generateSignature(requestBody);

            const response = await this.makeRequest('POST', '/serve/obtain/serveList', requestBody);

            if (response.code === 200 && response.success) {
                return {
                    success: true,
                    companies: response.data || [],
                    count: response.data?.length || 0,
                    provider: 'MUWE'
                };
            }

            return {
                success: false,
                message: response.message,
                provider: 'MUWE'
            };

        } catch (error) {
            console.error('❌ [MUWE] Get bill companies error:', error.message);
            return {
                success: false,
                error: error.message,
                provider: 'MUWE'
            };
        }
    }

    /**
     * SPEI Pay-Out (Send money to bank account)
     */
    async speiPayOut(payout) {
        const startTime = Date.now();

        try {
            const { accountNo, accountName, amount, reference, notifyUrl } = payout;

            console.log(`💸 [MUWE] Processing SPEI payout: ${accountNo} - ${amount} MXN`);

            const mchOrderNo = reference || `RLR_SPEI_OUT_${Date.now()}`;
            const nonceStr = this.generateNonce();

            const requestBody = {
                appId: this.config.appId,
                mchId: this.config.mchId,
                mchOrderNo: mchOrderNo,
                accountNo: accountNo,
                accountName: accountName,
                amount: Math.round(amount * 100), // Convert to cents
                currency: 'MXN',
                nonceStr: nonceStr
            };

            if (notifyUrl) {
                requestBody.notifyUrl = notifyUrl;
            }

            requestBody.sign = this.generateSignature(requestBody);

            const response = await this.makeRequest(
                'POST',
                '/api/unified/transfer/create',
                requestBody,
                { 'tmId': 'sipe_mx' }
            );

            const responseTime = Date.now() - startTime;

            if (response.resCode === 'SUCCESS') {
                return {
                    success: true,
                    provider: 'MUWE',
                    providerTransactionId: response.reference,
                    message: 'SPEI payout initiated',
                    responseTime: responseTime,
                    rawResponse: response
                };
            }

            return {
                success: false,
                provider: 'MUWE',
                message: response.errDes || 'SPEI payout failed',
                errorCode: response.errCode,
                responseTime: responseTime,
                rawResponse: response
            };

        } catch (error) {
            const responseTime = Date.now() - startTime;
            console.error('❌ [MUWE] SPEI payout error:', error.message);

            return {
                success: false,
                provider: 'MUWE',
                providerTransactionId: null,
                message: error.message,
                responseTime: responseTime,
                error: error.message
            };
        }
    }

    /**
     * OXXO Cash Payment (Generate payment voucher)
     */
    async oxxoPayment(payment) {
        const startTime = Date.now();

        try {
            const { amount, reference, notifyUrl } = payment;

            console.log(`🏪 [MUWE] Creating OXXO payment voucher: ${amount} MXN`);

            const mchOrderNo = reference || `RLR_OXXO_${Date.now()}`;
            const nonceStr = this.generateNonce();

            const requestBody = {
                appId: this.config.appId,
                mchId: this.config.mchId,
                mchOrderNo: mchOrderNo,
                amount: Math.round(amount * 100), // Convert to cents (min 1000 cents = 10 MXN)
                currency: 'MXN',
                payType: '3', // 3 = CASH (OXXO)
                nonceStr: nonceStr,
                notifyUrl: notifyUrl || `${this.config.baseUrl}/webhook/oxxo`
            };

            requestBody.sign = this.generateSignature(requestBody);

            const response = await this.makeRequest(
                'POST',
                '/api/unified/collection/create',
                requestBody,
                { 'tmId': 'oxxo_mx' }
            );

            const responseTime = Date.now() - startTime;

            if (response.resCode === 'SUCCESS') {
                return {
                    success: true,
                    provider: 'MUWE',
                    providerTransactionId: response.reference,
                    message: 'OXXO voucher created',
                    responseTime: responseTime,
                    barcodeUrl: response.barcodeUrl,
                    paymentUrl: response.url,
                    reference: response.reference,
                    expiresAt: response.expiresAt,
                    rawResponse: response
                };
            }

            return {
                success: false,
                provider: 'MUWE',
                message: response.errDes || 'OXXO voucher creation failed',
                errorCode: response.errCode,
                responseTime: responseTime,
                rawResponse: response
            };

        } catch (error) {
            const responseTime = Date.now() - startTime;
            console.error('❌ [MUWE] OXXO payment error:', error.message);

            return {
                success: false,
                provider: 'MUWE',
                providerTransactionId: null,
                message: error.message,
                responseTime: responseTime,
                error: error.message
            };
        }
    }

    /**
     * Query transaction status
     */
    async getTransactionStatus(orderId, mchOrderNo) {
        try {
            const nonceStr = this.generateNonce();

            const requestBody = {
                mchId: this.config.mchId,
                nonceStr: nonceStr
            };

            if (orderId) {
                requestBody.orderId = orderId;
            } else if (mchOrderNo) {
                requestBody.mchOrderNo = mchOrderNo;
            } else {
                throw new Error('Either orderId or mchOrderNo is required');
            }

            requestBody.sign = this.generateSignature(requestBody);

            const response = await this.makeRequest('POST', '/common/query/pay_order', requestBody);

            if (response.resCode === 'SUCCESS') {
                return {
                    success: true,
                    status: response.state,
                    amount: response.amount,
                    details: response,
                    provider: 'MUWE'
                };
            }

            return {
                success: false,
                message: response.errDes || 'Query failed',
                provider: 'MUWE'
            };

        } catch (error) {
            console.error('❌ [MUWE] Transaction status error:', error.message);
            return {
                success: false,
                error: error.message,
                provider: 'MUWE'
            };
        }
    }

    /**
     * Get products - not directly supported, returns bill companies instead
     */
    async getProducts(country = null) {
        console.log('[MUWE] Getting bill companies as products...');
        const result = await this.getBillCompanies(101); // Get bill payment companies
        return result.companies || [];
    }

    /**
     * Check balance - not applicable for MUWE (they manage merchant balance)
     */
    async checkBalance() {
        return {
            success: false,
            message: 'Balance check not available for MUWE provider',
            provider: 'MUWE'
        };
    }
}

module.exports = MUWEProvider;
