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
            console.log('[CSQ] Received transaction:', JSON.stringify(transaction));
            const { phone, amount, skuId, country = 'MX' } = transaction;

            // SKU ID is required (not operator ID)
            // Telcel = 396, Amigo Sin Limites = 683, Internet Amigo = 684
            const productSkuId = skuId || '396'; // Default to Telcel

            // Simple local reference format (numeric) - ALWAYS generate, don't use passed reference
            // CSQ requires simple numeric reference like "12356"
            const localRef = String(Date.now()).slice(-8);

            console.log(`📞 [CSQ] Processing topup: ${phone} - ${amount} MXN - SKU: ${productSkuId}`);

            // Step 1: Get Parameters (Required for proper flow, especially DummyTopup)
            // This step validates the operator and returns required fields
            try {
                console.log('[CSQ] Step 1: Getting parameters...');
                const parametersResponse = await this.makeRequest(
                    'GET',
                    `/pre-paid/recharge/parameters/${this.config.terminalId}/${productSkuId}`
                );
                console.log('[CSQ] Parameters response:', JSON.stringify(parametersResponse, null, 2));
            } catch (paramError) {
                console.log('[CSQ] Parameters call failed (may be optional for some products):', paramError.message);
                // Continue anyway - some products may not require parameters
            }

            // Step 2: Purchase
            // Format required by CSQ: localDateTime, account, amountToSendX100
            // amountToSendX100 = amount in CENTS (for USD products)
            // For DummyTopup and other USD products: 5 USD = 500 cents
            // Note: Amount parameter here should already be in the correct currency units
            const purchasePayload = {
                localDateTime: new Date().toISOString().slice(0, 19), // "2025-09-25T18:55:00"
                account: phone,
                amountToSendX100: Math.round(amount * 100) // Amount in cents (5 USD = 500)
            };

            const purchaseResponse = await this.makeRequest(
                'POST',
                `/pre-paid/recharge/purchase/${this.config.terminalId}/${productSkuId}/${localRef}`,
                purchasePayload
            );

            const responseTime = Date.now() - startTime;

            // Log full response for debugging
            console.log('[CSQ] Full Response:', JSON.stringify(purchaseResponse, null, 2));

            // Parse CSQ response
            const result = purchaseResponse?.items?.[0];
            const rc = result?.resultcode || result?.resultCode || result?.rc;

            console.log('[CSQ] Parsed result:', result);
            console.log('[CSQ] Result code:', rc);

            // Result code 10 = success (money moved)
            if (rc === 10 || rc === '10') {
                return {
                    success: true,
                    provider: 'CSQ',
                    providerTransactionId: result.supplierreference || result.transactionId || result.supplierToken,
                    message: result.resultmessage || result.resultText || 'Top-up successful',
                    responseTime: responseTime,
                    responseCode: rc,
                    rawResponse: purchaseResponse
                };
            } else {
                return {
                    success: false,
                    provider: 'CSQ',
                    providerTransactionId: result?.supplierreference || result?.transactionId,
                    message: result?.resultmessage || result?.resultText || this.getErrorMessage(rc),
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
     * Get available products from CSQ terminal configuration
     * Uses: GET /article/view-set/saleconditions/customer-config/{terminalId}/0
     */
    async getProducts(country = null) {
        try {
            // Use Token-based authentication instead of U/ST/SH for this endpoint
            const token = process.env.CSQ_TOKEN || '4cdba8f37ecc5ba8994c6a23030c9d4b';

            const response = await axios.get(
                `https://evsbus.csqworld.com/article/view-set/saleconditions/customer-config/${this.config.terminalId}/0`,
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'Token': token
                    },
                    timeout: 30000
                }
            );

            if (response.data && response.data.items) {
                const products = response.data.items.map(item => ({
                    id: item.id,
                    skuId: item.skuid,
                    operator: item.operator,
                    country: item.country,
                    topupType: item.topuptype,
                    denominations: item.availabledenominationscents,
                    exchangeRate: item.ex,
                    exchangeUnits: item.exunits,
                    countryId: item.countryid,
                    msisdnMask: item.msisdnmask
                }));

                console.log(`✅ [CSQ] Loaded ${products.length} products from terminal ${this.config.terminalId}`);

                // Filter by country if requested
                if (country) {
                    return products.filter(p =>
                        p.country.toLowerCase().includes(country.toLowerCase()) ||
                        p.country === country
                    );
                }

                return products;
            }

            return [];

        } catch (error) {
            console.error('❌ [CSQ] Get products error:', error.message);
            return [];
        }
    }

    /**
     * Get product by SKU ID
     */
    async getProductBySkuId(skuId) {
        const products = await this.getProducts();
        return products.find(p => p.skuId === parseInt(skuId));
    }

    /**
     * Get products for Mexico
     */
    async getMexicoProducts() {
        return await this.getProducts('Mexico');
    }

    /**
     * Get DummyTopup product (for testing)
     * SKU ID: 9990
     *
     * IMPORTANT - DummyTopup Simulation Logic:
     * - MUST call GET /parameters first, then POST /purchase
     * - Last 3 digits of account determine the result code (rc):
     *   - Account ending in "000" → rc=0 (success)
     *   - Account ending in "001" → rc=971 (error)
     *   - Account ending in "002" → rc=990 (error)
     *   - Any other ending → rc=991 (default error)
     *
     * Examples:
     *   - "600000000" → Success (rc=0)
     *   - "600000001" → Error 971
     *   - "600000002" → Error 990
     *   - "556637468310" → Error 991 (default)
     *
     * See: https://csq-docs.apidog.io/doc-1259308
     */
    async getDummyTopupProduct() {
        const products = await this.getProducts();
        return products.find(p => p.skuId === 9990);
    }
}

module.exports = CSQProvider;
