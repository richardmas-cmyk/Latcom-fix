/**
 * Twilio Integration Service
 * Supports SMS and WhatsApp messaging
 */

const twilio = require('twilio');

class TwilioService {
    constructor() {
        this.accountSid = process.env.TWILIO_ACCOUNT_SID;
        this.authToken = process.env.TWILIO_AUTH_TOKEN;
        this.phoneNumber = process.env.TWILIO_PHONE_NUMBER; // Your Twilio phone number
        this.whatsappNumber = process.env.TWILIO_WHATSAPP_NUMBER; // WhatsApp: whatsapp:+14155238886

        this.isConfigured = !!(this.accountSid && this.authToken && this.phoneNumber);

        if (this.isConfigured) {
            this.client = twilio(this.accountSid, this.authToken);
            console.log('✅ Twilio service configured');
        } else {
            console.log('⚠️  Twilio service not configured - missing credentials');
        }
    }

    /**
     * Send SMS message
     */
    async sendSMS(to, message) {
        if (!this.isConfigured) {
            console.log('⚠️  Twilio not configured - SMS not sent');
            return { success: false, error: 'Twilio not configured' };
        }

        try {
            console.log(`📱 [Twilio] Sending SMS to ${to}`);

            const response = await this.client.messages.create({
                body: message,
                from: this.phoneNumber,
                to: to
            });

            console.log(`✅ [Twilio] SMS sent successfully: ${response.sid}`);

            return {
                success: true,
                messageSid: response.sid,
                status: response.status,
                to: to
            };

        } catch (error) {
            console.error('❌ [Twilio] SMS error:', error.message);
            return {
                success: false,
                error: error.message,
                code: error.code
            };
        }
    }

    /**
     * Send WhatsApp message
     */
    async sendWhatsApp(to, message) {
        if (!this.isConfigured) {
            console.log('⚠️  Twilio not configured - WhatsApp not sent');
            return { success: false, error: 'Twilio not configured' };
        }

        try {
            console.log(`💬 [Twilio] Sending WhatsApp to ${to}`);

            // Format WhatsApp number (must start with whatsapp:)
            const whatsappTo = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
            const whatsappFrom = this.whatsappNumber || 'whatsapp:+14155238886'; // Twilio sandbox default

            const response = await this.client.messages.create({
                body: message,
                from: whatsappFrom,
                to: whatsappTo
            });

            console.log(`✅ [Twilio] WhatsApp sent successfully: ${response.sid}`);

            return {
                success: true,
                messageSid: response.sid,
                status: response.status,
                to: to
            };

        } catch (error) {
            console.error('❌ [Twilio] WhatsApp error:', error.message);
            return {
                success: false,
                error: error.message,
                code: error.code
            };
        }
    }

    /**
     * Send transaction notification (SMS + WhatsApp)
     */
    async sendTransactionNotification(transaction, channels = ['sms']) {
        const { phone, amount, status, operatorTransactionId, currency = 'MXN' } = transaction;

        // Format message
        const message = this.formatTransactionMessage(transaction);

        const results = {
            sms: null,
            whatsapp: null
        };

        // Send SMS if requested
        if (channels.includes('sms')) {
            results.sms = await this.sendSMS(phone, message);
        }

        // Send WhatsApp if requested
        if (channels.includes('whatsapp')) {
            results.whatsapp = await this.sendWhatsApp(phone, message);
        }

        return results;
    }

    /**
     * Product-specific SMS messages
     */
    getProductMessages() {
        return {
            10: '¡Gracias por elegir Movistar! Has recibido tu paquete de $10 con 200 MB para navegar por 1 día, WhatsApp ilimitado, 500 MB para redes sociales y llamadas y mensajes ilimitados a México, EE. UU. y Canadá. ¡Disfruta tu conexión!',
            20: '¡Gracias por elegir Movistar! Has recibido tu paquete de $20 con 400 MB para navegar por 2 días, WhatsApp ilimitado, 1 GB para redes sociales y llamadas y mensajes ilimitados a México, EE. UU. y Canadá. ¡Mantente conectado!',
            30: '¡Gracias por elegir Movistar! Has recibido tu paquete de $30 con 600 MB para navegar por 3 días, WhatsApp ilimitado, 1.5 GB para redes sociales, 250 MB para video, y llamadas y mensajes ilimitados a México, EE. UU. y Canadá. ¡Sigue navegando sin límites!',
            50: '¡Gracias por elegir Movistar! Has recibido tu paquete de $50 con 1 GB para navegar por 7 días, WhatsApp ilimitado, 250 MB para video, 3 GB para redes sociales, y llamadas y mensajes ilimitados a México, EE. UU. y Canadá. ¡Tu conexión está lista!',
            60: '¡Gracias por elegir Movistar! Has recibido tu paquete de $60 con 1 GB para navegar por 7 días, YouTube y TikTok ilimitados, y acceso ilimitado a WhatsApp, Instagram, Facebook y Messenger. ¡Aprovecha tus apps favoritas con Movistar!',
            100: '¡Gracias por elegir Movistar! Has recibido tu paquete de $100 con 3 GB para navegar por 14 días, WhatsApp y redes sociales ilimitadas, 750 MB para video (Netflix, YouTube, TikTok) y llamadas y mensajes ilimitados a México, EE. UU. y Canadá. ¡Tu recarga está activa!'
        };
    }

    /**
     * Format transaction message
     */
    formatTransactionMessage(transaction) {
        const {
            amount,
            currency = 'MXN',
            status,
            operatorTransactionId,
            phone,
            provider = 'Relier'
        } = transaction;

        if (status === 'SUCCESS') {
            // Get product-specific message based on amount
            const productMessages = this.getProductMessages();
            const productMessage = productMessages[amount];

            // Return product-specific message if available, otherwise generic message
            if (productMessage) {
                return productMessage;
            } else {
                return `Gracias por confiar en Movistar. Recibio un paquete de ${amount} ${currency} a su telefono numero ${phone}. Que disfrute.`;
            }
        } else {
            return `❌ Recarga Fallida\n\n` +
                   `💰 Monto: $${amount} ${currency}\n` +
                   `📱 Teléfono: ${phone}\n` +
                   `Estado: ${status}\n\n` +
                   `Contacta soporte si necesitas ayuda.\n` +
                   `Email: support@relier.group`;
        }
    }

    /**
     * Send balance alert
     */
    async sendBalanceAlert(customer, balance, threshold) {
        const message = `⚠️ Low Balance Alert\n\n` +
                       `Customer: ${customer.company_name}\n` +
                       `Current Balance: $${balance} USD\n` +
                       `Threshold: $${threshold} USD\n\n` +
                       `Please add funds to continue processing transactions.`;

        return await this.sendSMS(customer.phone, message);
    }

    /**
     * Send OTP/verification code
     */
    async sendVerificationCode(phone, code) {
        const message = `Your Relier Hub verification code is: ${code}\n\n` +
                       `This code will expire in 10 minutes.\n` +
                       `Do not share this code with anyone.`;

        return await this.sendSMS(phone, message);
    }

    /**
     * Send welcome message
     */
    async sendWelcomeMessage(customer) {
        const message = `Welcome to Relier Hub! 🎉\n\n` +
                       `Your account is now active.\n` +
                       `Customer ID: ${customer.customer_id}\n\n` +
                       `You can now start processing topup transactions.\n` +
                       `Visit https://latcom-fix-production.up.railway.app/dashboard for your dashboard.`;

        return await this.sendSMS(customer.phone, message);
    }

    /**
     * Send daily summary
     */
    async sendDailySummary(customer, summary) {
        const message = `📊 Daily Summary - ${new Date().toLocaleDateString()}\n\n` +
                       `Transactions: ${summary.count}\n` +
                       `Total Amount: ${summary.total} MXN\n` +
                       `Successful: ${summary.successful}\n` +
                       `Failed: ${summary.failed}\n` +
                       `Current Balance: $${summary.balance} USD\n\n` +
                       `Relier Hub`;

        return await this.sendSMS(customer.phone, message);
    }

    /**
     * Send invoice notification
     */
    async sendInvoiceNotification(customer, invoice) {
        const message = `📄 New Invoice Generated\n\n` +
                       `Invoice #: ${invoice.invoice_number}\n` +
                       `Period: ${invoice.period_start} to ${invoice.period_end}\n` +
                       `Total: $${invoice.total_amount} USD\n` +
                       `Transactions: ${invoice.transaction_count}\n\n` +
                       `View invoice at: ${invoice.url || 'https://latcom-fix-production.up.railway.app/admin'}`;

        return await this.sendSMS(customer.phone, message);
    }

    /**
     * Verify webhook signature (for incoming messages)
     */
    validateWebhook(signature, url, params) {
        if (!this.isConfigured) {
            return false;
        }

        try {
            return twilio.validateRequest(this.authToken, signature, url, params);
        } catch (error) {
            console.error('❌ [Twilio] Webhook validation error:', error.message);
            return false;
        }
    }

    /**
     * Parse incoming message
     */
    parseIncomingMessage(body) {
        return {
            from: body.From,
            to: body.To,
            message: body.Body,
            messageSid: body.MessageSid,
            accountSid: body.AccountSid,
            isWhatsApp: body.From?.startsWith('whatsapp:'),
            timestamp: new Date()
        };
    }

    /**
     * Auto-reply to incoming messages
     */
    generateAutoReply(message) {
        const text = message.message.toLowerCase();

        if (text.includes('balance')) {
            return 'To check your balance, please visit: https://latcom-fix-production.up.railway.app/dashboard';
        }

        if (text.includes('help')) {
            return 'Relier Hub Support\n\n' +
                   'Commands:\n' +
                   '• BALANCE - Check account balance\n' +
                   '• HELP - Show this message\n' +
                   '• SUPPORT - Contact support\n\n' +
                   'Visit: https://latcom-fix-production.up.railway.app';
        }

        if (text.includes('support')) {
            return 'For support, please email: support@relier.group\n' +
                   'Or visit: https://latcom-fix-production.up.railway.app/admin';
        }

        // Default reply
        return 'Thank you for contacting Relier Hub!\n\n' +
               'Reply HELP for available commands.\n' +
               'Visit: https://latcom-fix-production.up.railway.app';
    }
}

module.exports = new TwilioService();
