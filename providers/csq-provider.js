const axios = require('axios');
const crypto = require('crypto');
const BaseProvider = require('./base-provider');

/**
 * CSQ Provider Implementation
 * Supports: Topups (prepaid), bill payments (postpaid), vouchers - multiple countries
 *
 * Authentication: SHA256 timestamped salted hash
 * API: REST/JSON (eVSB system)
 */
class CSQProvider extends BaseProvider {
    constructor() {
        super('CSQ', {
            baseUrl: process.env.CSQ_BASE_URL,
            username: process.env.CSQ_USERNAME,
            password: process.env.CSQ_PASSWORD,
            terminalId: process.env.CSQ_TERMINAL_ID,
            defaultOperatorId: process.env.CSQ_DEFAULT_OPERATOR_ID || '1' // Mexico operator
        });

        this.isConfigured = !!(this.config.baseUrl && this.config.username &&
                               this.config.password && this.config.terminalId);

        if (this.isConfigured) {
            console.log('✅ CSQ provider configured:', this.config.baseUrl);
        } else {
            console.log('⚠️  CSQ provider not configured - missing credentials');
        }
    }

    getCapabilities() {
        return {
            topups: true,
            billPayments: true,
            vouchers: true,
            countries: ['MX', 'US', 'CO', 'BR', 'AR'], // TODO: Get full list from CSQ
            operators: [], // Dynamically loaded
            currencies: ['USD', 'MXN', 'COP', 'BRL', 'ARS'],
            features: ['prepaid_recharge', 'postpaid_bills', 'vouchers', 'supermarket_vouchers']
        };
    }

    /**
     * Generate CSQ authentication headers
     * Headers: U, ST, SH
     */
    generateAuthHeaders() {
        const ST = Math.floor(Date.now() / 1000).toString(); // Unix timestamp
        const password = this.config.password;

        // SHA256 hash calculations
        const pass_sha = crypto.createHash('sha256').update(password).digest('hex');
        const salt_sha = crypto.createHash('sha256').update(ST).digest('hex');
        const SH = crypto.createHash('sha256').update(pass_sha + salt_sha).digest('hex');

        return {
            'U': this.config.username,
            'ST': ST,
            'SH': SH,
            'Accept': 'application/json',
            'Accept-Encoding': 'gzip',
            'Content-Type': 'application/json',
            'X-Real-Ip': '0.0.0.0', // Will be replaced by actual IP in production
            'Cache-Hash': '0', // Simplified for now
            'Agent': 'Relier-Hub/1.0'
        };
    }

    /**
     * Make authenticated request to CSQ API
     */
    async makeRequest(method, path, data = null) {
        const url = `${this.config.baseUrl}${path}`;
        const headers = this.generateAuthHeaders();

        try {
            const config = {
                method: method,
                url: url,
                headers: headers,
                timeout: 60000 // 60 seconds as per CSQ docs
            };

            if (data && (method === 'POST' || method === 'PUT')) {
                config.data = data;
            }

            const response = await axios(config);
            return response.data;

        } catch (error) {
            if (error.response) {
                console.error('[CSQ] API Error:', error.response.status, error.response.data);
                throw new Error(`CSQ API error: ${error.response.data?.message || error.response.statusText}`);
            }
            throw error;
        }
    }

    /**
     * Test CSQ connection
     */
    async ping() {
        try {
            const headers = this.generateAuthHeaders();
            const response = await axios.get(`${this.config.baseUrl}/ping/relier-test`, { headers });
            return { success: true, data: response.data };
        } catch (error) {
            console.error('[CSQ] Ping failed:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get CSQ balance
     */
    async checkBalance() {
        try {
            const response = await this.makeRequest('GET', '/external-point-of-sale/by-file/balances');

            if (response && response.items) {
                return {
                    success: true,
                    balance: response.items[0]?.balance || 0,
                    currency: response.items[0]?.currency || 'USD',
                    provider: 'CSQ',
                    rawResponse: response
                };
            }

            return { success: false, provider: 'CSQ', message: 'Invalid balance response' };

        } catch (error) {
            console.error('[CSQ] Check balance error:', error.message);
            return {
                success: false,
                error: error.message,
                provider: 'CSQ'
            };
        }
    }

    /**
     * Prepaid topup (recharge)
     * Flow: Get Parameters → (optional) Get Products → Purchase
     */
    async topup(transaction) {
        const startTime = Date.now();

        if (!this.isConfigured) {
            throw new Error('CSQ provider not configured');
        }

        try {
            const { phone, amount, reference, operatorId, country = 'MX' } = transaction;
            const opId = operatorId || this.config.defaultOperatorId;
            const localRef = reference || `RLR_${Date.now()}`;

            console.log(`📞 [CSQ] Processing topup: ${phone} - ${amount} - Operator: ${opId}`);

            // Step 1: Get parameters (to check if dynamic products needed)
            let parametersResponse;
            try {
                parametersResponse = await this.makeRequest(
                    'GET',
                    `/pre-paid/recharge/parameters/${this.config.terminalId}/${opId}`
                );
            } catch (error) {
                console.log(`⚠️  [CSQ] Parameters check failed, proceeding with direct purchase:`, error.message);
            }

            // Step 2: If dynamic, get products first
            if (parametersResponse?.items?.[0]?.dynamic) {
                try {
                    const productsResponse = await this.makeRequest(
                        'GET',
                        `/pre-paid/recharge/products/${this.config.terminalId}/${opId}/${phone}`
                    );
                    console.log(`[CSQ] Retrieved ${productsResponse?.items?.length || 0} products`);
                } catch (error) {
                    console.log(`⚠️  [CSQ] Products retrieval failed:`, error.message);
                }
            }

            // Step 3: Purchase
            const purchasePayload = {
                account: phone,
                amount: amount,
                // Additional fields if needed from parameters response
            };

            const purchaseResponse = await this.makeRequest(
                'POST',
                `/pre-paid/recharge/purchase/${this.config.terminalId}/${opId}/${localRef}`,
                purchasePayload
            );

            const responseTime = Date.now() - startTime;

            // Parse CSQ response
            const result = purchaseResponse?.items?.[0];
            const rc = result?.rc || result?.resultCode;

            // Result code 10 = success (money moved)
            if (rc === 10 || rc === '10') {
                return {
                    success: true,
                    provider: 'CSQ',
                    providerTransactionId: result.transactionId || result.supplierToken,
                    message: result.resultText || 'Top-up successful',
                    responseTime: responseTime,
                    responseCode: rc,
                    rawResponse: purchaseResponse
                };
            } else {
                return {
                    success: false,
                    provider: 'CSQ',
                    providerTransactionId: result?.transactionId,
                    message: result?.resultText || this.getErrorMessage(rc),
                    responseTime: responseTime,
                    responseCode: rc,
                    rawResponse: purchaseResponse
                };
            }

        } catch (error) {
            const responseTime = Date.now() - startTime;
            console.error('❌ [CSQ] Topup error:', error.message);

            return {
                success: false,
                provider: 'CSQ',
                providerTransactionId: null,
                message: error.message,
                responseTime: responseTime,
                error: error.message
            };
        }
    }

    /**
     * Bill payment (postpaid)
     * Flow: Get Parameters → Get Invoices → Payment
     */
    async billPayment(payment) {
        const startTime = Date.now();

        if (!this.isConfigured) {
            throw new Error('CSQ provider not configured');
        }

        try {
            const { accountNumber, amount, operatorId, reference, billerId } = payment;
            const opId = operatorId || billerId;
            const localRef = reference || `RLR_BILL_${Date.now()}`;

            console.log(`💳 [CSQ] Processing bill payment: Account ${accountNumber} - ${amount}`);

            // Step 1: Get parameters
            const parametersResponse = await this.makeRequest(
                'GET',
                `/post-paid/bill-payment/parameters/${this.config.terminalId}/${opId}`
            );

            // Step 2: Get invoices
            const invoicesPayload = {
                account: accountNumber,
                // Additional fields from parameters
            };

            const invoicesResponse = await this.makeRequest(
                'POST',
                `/post-paid/bill-payment/get-invoices/${this.config.terminalId}/${opId}`,
                invoicesPayload
            );

            // Step 3: Payment (implementation depends on invoice structure)
            // TODO: Complete based on invoice response structure

            const responseTime = Date.now() - startTime;

            return {
                success: false,
                provider: 'CSQ',
                providerTransactionId: null,
                message: 'Bill payment flow needs invoice details',
                responseTime: responseTime
            };

        } catch (error) {
            const responseTime = Date.now() - startTime;
            console.error('❌ [CSQ] Bill payment error:', error.message);

            return {
                success: false,
                provider: 'CSQ',
                providerTransactionId: null,
                message: error.message,
                responseTime: responseTime,
                error: error.message
            };
        }
    }

    /**
     * Purchase voucher/PIN
     */
    async purchaseVoucher(voucher) {
        const startTime = Date.now();

        if (!this.isConfigured) {
            throw new Error('CSQ provider not configured');
        }

        try {
            const { operatorId, amount, quantity = 1, reference, productId } = voucher;
            const localRef = reference || `RLR_VCH_${Date.now()}`;

            console.log(`🎁 [CSQ] Purchasing voucher: Operator ${operatorId} - ${amount}`);

            // Purchase voucher
            const purchasePayload = {
                amount: amount,
                quantity: quantity,
                productId: productId
            };

            const purchaseResponse = await this.makeRequest(
                'POST',
                `/pre-paid/vouchers/purchase/${this.config.terminalId}/${operatorId}/${localRef}`,
                purchasePayload
            );

            const result = purchaseResponse?.items?.[0];
            const rc = result?.rc || result?.resultCode;

            const responseTime = Date.now() - startTime;

            if (rc === 10 || rc === '10') {
                // Check if additional data needed
                let pins = [];
                if (result?.hasAdditionalData) {
                    try {
                        const additionalDataResponse = await this.makeRequest(
                            'GET',
                            `/pre-paid/vouchers/additional-data/${this.config.terminalId}/${operatorId}/${result.supplierToken}`
                        );
                        pins = additionalDataResponse?.items || [];
                    } catch (error) {
                        console.error('[CSQ] Failed to get additional voucher data:', error.message);
                    }
                }

                return {
                    success: true,
                    provider: 'CSQ',
                    providerTransactionId: result.transactionId || result.supplierToken,
                    message: result.resultText || 'Voucher purchased successfully',
                    pins: pins,
                    responseTime: responseTime,
                    rawResponse: purchaseResponse
                };
            } else {
                return {
                    success: false,
                    provider: 'CSQ',
                    providerTransactionId: result?.transactionId,
                    message: result?.resultText || this.getErrorMessage(rc),
                    responseTime: responseTime,
                    rawResponse: purchaseResponse
                };
            }

        } catch (error) {
            const responseTime = Date.now() - startTime;
            console.error('❌ [CSQ] Voucher purchase error:', error.message);

            return {
                success: false,
                provider: 'CSQ',
                providerTransactionId: null,
                message: error.message,
                responseTime: responseTime,
                error: error.message
            };
        }
    }

    /**
     * Get transaction status
     */
    async getTransactionStatus(providerTransactionId, creationDate = null) {
        try {
            const date = creationDate || new Date().toISOString().split('T')[0];

            const response = await this.makeRequest(
                'GET',
                `/util/transaction/info/${this.config.terminalId}/${providerTransactionId}/${date}`
            );

            if (response?.items?.[0]) {
                return {
                    success: true,
                    status: response.items[0],
                    provider: 'CSQ'
                };
            }

            return { success: false, provider: 'CSQ', message: 'Transaction not found' };

        } catch (error) {
            console.error('❌ [CSQ] Transaction status error:', error.message);
            return {
                success: false,
                error: error.message,
                provider: 'CSQ'
            };
        }
    }

    /**
     * Revert/refund transaction
     */
    async revertTransaction(operatorId, localReference) {
        try {
            const response = await this.makeRequest(
                'POST',
                `/util/revert/${this.config.terminalId}/${operatorId}/${localReference}`
            );

            const result = response?.items?.[0];
            const rc = result?.rc;

            // Result code 20 = refund OK
            if (rc === 20 || rc === '20') {
                return {
                    success: true,
                    provider: 'CSQ',
                    message: 'Transaction reverted successfully'
                };
            }

            return {
                success: false,
                provider: 'CSQ',
                message: result?.resultText || this.getErrorMessage(rc)
            };

        } catch (error) {
            console.error('❌ [CSQ] Revert error:', error.message);
            return {
                success: false,
                error: error.message,
                provider: 'CSQ'
            };
        }
    }

    /**
     * Get error message from result code
     */
    getErrorMessage(rc) {
        const errorCodes = {
            13: 'Insufficient balance',
            911: 'Credit limit exceeded',
            977: 'Product temporarily disabled',
            980: 'Product unavailable',
            990: 'Timeout with operator',
            991: 'General system error',
            992: 'Operator internal error',
            993: 'Operator timeout',
            998: 'Unknown error',
            516: 'Invalid hash',
            517: 'Invalid parameters',
            923: 'Operation not allowed',
            925: 'Incorrect date',
            927: 'Amount not allowed',
            931: 'Invalid destination format',
            933: 'Operator not available',
            934: 'Destination banned',
            970: 'Duplicate transaction',
            971: 'Banned by operator'
        };

        return errorCodes[rc] || `Error code: ${rc}`;
    }

    /**
     * Get available products (not implemented in docs - placeholder)
     */
    async getProducts(country = null) {
        console.log('[CSQ] Get products - requires operator ID, use specific endpoints');
        return [];
    }
}

module.exports = CSQProvider;
