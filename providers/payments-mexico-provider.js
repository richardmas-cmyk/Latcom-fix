const axios = require('axios');
const BaseProvider = require('./base-provider');

/**
 * Payments Mexico Provider Implementation
 * Direct integration with Telefonica Mexico (Movistar)
 * Supports: Topups (recarga tradicional and paquetes)
 *
 * Authentication: PASSWORD_IVR + PUNTO_VENTA (distributor ID)
 * API: SOAP/XML Web Service
 * Endpoint: http://srm.movistar.com.mx/services/RecargaServicioPort?wsdl
 */
class PaymentsMexicoProvider extends BaseProvider {
    constructor() {
        super('PaymentsMexico', {
            wsdlUrl: process.env.TELEFONICA_WSDL_URL || 'http://srm.movistar.com.mx/services/RecargaServicioPort?wsdl',
            passwordIvr: process.env.TELEFONICA_PASSWORD_IVR,
            puntoVenta: process.env.TELEFONICA_PUNTO_VENTA, // Distributor ID
            defaultType: process.env.TELEFONICA_DEFAULT_TYPE || '00' // 00 = traditional topup, 03 = packet sale
        });

        this.isConfigured = !!(this.config.passwordIvr && this.config.puntoVenta);

        if (this.isConfigured) {
            console.log('✅ Payments Mexico provider configured:', this.config.wsdlUrl);
        } else {
            console.log('⚠️  Payments Mexico provider not configured - missing credentials');
        }
    }

    getCapabilities() {
        return {
            topups: true,
            billPayments: false, // Not implemented in current spec
            vouchers: false,
            countries: ['MX'], // Mexico only
            operators: ['Telefonica', 'Movistar'],
            currencies: ['MXN'],
            features: ['traditional_recharge', 'packet_sale']
        };
    }

    /**
     * Build SOAP XML request for Telefonica
     */
    buildSoapRequest(transaction) {
        const { phone, amount, transactionId, transactionType = '00', key = '' } = transaction;

        // Generate unique transaction ID if not provided (8-12 digits recommended)
        const txId = transactionId || String(Date.now()).slice(-12);

        // TIPO: 00 = recarga tradicional, 03 = venta de paquetes
        const tipo = transactionType;

        // DN: Phone number (10 digits for Mexico, without country code)
        const dn = phone.replace(/\D/g, '').slice(-10);

        // DI: Distributor identifier (optional, can be empty)
        const di = '';

        // CLAVE: Product key (optional, for packet sales)
        const clave = key;

        const soapEnvelope = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:rec="http://recarga.ws.movistar.com">
   <soapenv:Header/>
   <soapenv:Body>
      <rec:RECARGA_ELECTRONICA>
         <PASSWORD_IVR>${this.config.passwordIvr}</PASSWORD_IVR>
         <PUNTO_VENTA>${this.config.puntoVenta}</PUNTO_VENTA>
         <MONTO>${amount}</MONTO>
         <DN>${dn}</DN>
         <DI>${di}</DI>
         <TRANSACCION>${txId}</TRANSACCION>
         <TIPO>${tipo}</TIPO>
         <CLAVE>${clave}</CLAVE>
      </rec:RECARGA_ELECTRONICA>
   </soapenv:Body>
</soapenv:Envelope>`;

        return { soapEnvelope, txId };
    }

    /**
     * Parse SOAP XML response from Telefonica
     */
    parseSoapResponse(xmlResponse) {
        try {
            // Extract RESULTADO (EXITO or ERROR)
            const resultadoMatch = xmlResponse.match(/<RESULTADO>(.*?)<\/RESULTADO>/);
            const resultado = resultadoMatch ? resultadoMatch[1].trim() : null;

            // Extract NUM_AUTORIZACION (authorization number)
            const numAuthMatch = xmlResponse.match(/<NUM_AUTORIZACION>(.*?)<\/NUM_AUTORIZACION>/);
            const numAutorizacion = numAuthMatch ? numAuthMatch[1].trim() : null;

            // Extract MENSAJE (message)
            const mensajeMatch = xmlResponse.match(/<MENSAJE>(.*?)<\/MENSAJE>/);
            const mensaje = mensajeMatch ? mensajeMatch[1].trim() : null;

            return {
                resultado,
                numAutorizacion,
                mensaje
            };
        } catch (error) {
            console.error('[PaymentsMexico] Error parsing SOAP response:', error.message);
            throw new Error('Failed to parse SOAP response');
        }
    }

    /**
     * Make SOAP request to Telefonica API
     */
    async makeSoapRequest(soapEnvelope) {
        try {
            const response = await axios.post(
                this.config.wsdlUrl,
                soapEnvelope,
                {
                    headers: {
                        'Content-Type': 'text/xml; charset=utf-8',
                        'SOAPAction': 'RECARGA_ELECTRONICA'
                    },
                    timeout: 10000 // 10 seconds (API response time: 0.1 to 5 seconds)
                }
            );

            return response.data;
        } catch (error) {
            if (error.response) {
                console.error('[PaymentsMexico] API Error:', error.response.status, error.response.data);
                throw new Error(`Telefonica API error: ${error.response.statusText}`);
            } else if (error.code === 'ECONNABORTED') {
                throw new Error('Telefonica API timeout');
            }
            throw error;
        }
    }

    /**
     * Process topup transaction
     */
    async topup(transaction) {
        const startTime = Date.now();

        if (!this.isConfigured) {
            throw new Error('Telefonica provider not configured');
        }

        try {
            console.log('[PaymentsMexico] Received transaction:', JSON.stringify(transaction));
            const { phone, amount } = transaction;

            // Validate phone number (should be 10 digits for Mexico)
            const cleanPhone = phone.replace(/\D/g, '');
            if (cleanPhone.length !== 10 && cleanPhone.length !== 12) {
                throw new Error('Invalid phone number format. Expected 10 digits (MX) or 12 digits with country code');
            }

            // Validate amount
            if (!amount || amount <= 0) {
                throw new Error('Invalid amount. Must be greater than 0');
            }

            console.log(`📞 [PaymentsMexico] Processing topup: ${cleanPhone} - ${amount} MXN`);

            // Build SOAP request
            const { soapEnvelope, txId } = this.buildSoapRequest(transaction);

            console.log(`🔄 [PaymentsMexico] Sending SOAP request with transaction ID: ${txId}`);

            // Send SOAP request
            const xmlResponse = await this.makeSoapRequest(soapEnvelope);

            // Parse response
            const { resultado, numAutorizacion, mensaje } = this.parseSoapResponse(xmlResponse);

            const responseTime = Date.now() - startTime;

            console.log(`📥 [PaymentsMexico] Response: ${resultado} - ${mensaje}`);

            // Check if successful
            if (resultado === 'EXITO') {
                return {
                    success: true,
                    provider: 'PaymentsMexico',
                    providerTransactionId: numAutorizacion || txId,
                    message: mensaje || 'Top-up successful',
                    responseTime: responseTime,
                    transactionId: txId,
                    rawResponse: xmlResponse
                };
            } else {
                return {
                    success: false,
                    provider: 'PaymentsMexico',
                    providerTransactionId: numAutorizacion || txId,
                    message: mensaje || 'Top-up failed',
                    responseTime: responseTime,
                    transactionId: txId,
                    resultado: resultado,
                    rawResponse: xmlResponse
                };
            }

        } catch (error) {
            const responseTime = Date.now() - startTime;
            console.error('❌ [PaymentsMexico] Topup error:', error.message);

            return {
                success: false,
                provider: 'PaymentsMexico',
                providerTransactionId: null,
                message: error.message,
                responseTime: responseTime,
                error: error.message
            };
        }
    }

    /**
     * Test connection to Telefonica API (basic connectivity check)
     */
    async ping() {
        try {
            // Attempt to fetch WSDL
            const response = await axios.get(this.config.wsdlUrl, { timeout: 5000 });

            if (response.data && response.data.includes('wsdl:definitions')) {
                return { success: true, message: 'WSDL endpoint accessible' };
            }

            return { success: false, message: 'WSDL endpoint returned invalid response' };
        } catch (error) {
            console.error('[PaymentsMexico] Ping failed:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Check balance (not supported by Telefonica API)
     */
    async checkBalance() {
        return {
            success: false,
            provider: 'PaymentsMexico',
            message: 'Balance check not supported by Payments Mexico API'
        };
    }

    /**
     * Get products (not implemented - requires separate product catalog)
     */
    async getProducts(country = null) {
        console.log('[PaymentsMexico] Get products - requires product catalog configuration');
        return [];
    }

    /**
     * Transaction status check (not directly supported, would need separate implementation)
     */
    async getTransactionStatus(providerTransactionId) {
        return {
            success: false,
            provider: 'PaymentsMexico',
            message: 'Transaction status check not supported by current API specification'
        };
    }

    /**
     * Get error message from common response codes
     */
    getErrorMessage(codigo) {
        const errorCodes = {
            'EXITO': 'Transaction successful',
            'ERROR': 'Transaction failed',
            'DN_INVALIDO': 'Invalid phone number',
            'MONTO_INVALIDO': 'Invalid amount',
            'SALDO_INSUFICIENTE': 'Insufficient balance',
            'SERVICIO_NO_DISPONIBLE': 'Service unavailable',
            'TIMEOUT': 'Request timeout',
            'AUTENTICACION_FALLIDA': 'Authentication failed',
            'PARAMETROS_INVALIDOS': 'Invalid parameters'
        };

        return errorCodes[codigo] || `Unknown error: ${codigo}`;
    }
}

module.exports = PaymentsMexicoProvider;
