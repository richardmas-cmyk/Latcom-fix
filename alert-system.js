const nodemailer = require('nodemailer');

/**
 * Alert System for Relier Billing
 * Handles email notifications for critical events
 */

class AlertSystem {
    constructor() {
        this.alertEmail = process.env.ALERT_EMAIL || null;
        this.smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
        this.smtpPort = process.env.SMTP_PORT || 587;
        this.smtpUser = process.env.SMTP_USER || null;
        this.smtpPass = process.env.SMTP_PASS || null;

        // Tracking state
        this.consecutiveFailures = 0;
        this.lastBalanceAlerts = {}; // Track when we last alerted per customer

        // Initialize email transporter
        if (this.smtpUser && this.smtpPass) {
            this.transporter = nodemailer.createTransport({
                host: this.smtpHost,
                port: this.smtpPort,
                secure: false,
                auth: {
                    user: this.smtpUser,
                    pass: this.smtpPass
                }
            });
            console.log('✅ Alert system configured with email:', this.alertEmail);
        } else {
            console.log('⚠️  Alert system disabled - no SMTP credentials configured');
            this.transporter = null;
        }
    }

    /**
     * Send email alert
     */
    async sendEmail(subject, htmlBody, textBody) {
        if (!this.transporter || !this.alertEmail) {
            console.log('⚠️  Alert skipped - email not configured');
            return false;
        }

        try {
            const info = await this.transporter.sendMail({
                from: `"Relier Billing Alert" <${this.smtpUser}>`,
                to: this.alertEmail,
                subject: subject,
                text: textBody,
                html: htmlBody
            });

            console.log('✅ Alert email sent:', info.messageId);
            return true;
        } catch (error) {
            console.error('❌ Failed to send alert email:', error.message);
            return false;
        }
    }

    /**
     * Track transaction failure and alert on consecutive failures
     */
    async trackTransactionFailure(transaction) {
        this.consecutiveFailures++;

        console.log(`⚠️  Consecutive failures: ${this.consecutiveFailures}`);

        // Alert on 10 consecutive failures
        if (this.consecutiveFailures === 10) {
            await this.sendConsecutiveFailureAlert(transaction);
        }
    }

    /**
     * Reset failure counter on success
     */
    resetFailureCounter() {
        if (this.consecutiveFailures > 0) {
            console.log(`✅ Failure streak ended at ${this.consecutiveFailures}`);
            this.consecutiveFailures = 0;
        }
    }

    /**
     * Alert for 10 consecutive failures
     */
    async sendConsecutiveFailureAlert(lastTransaction) {
        const subject = '🚨 ALERT: 10 Consecutive Transaction Failures';

        const htmlBody = `
            <h2 style="color: #ef4444;">🚨 Critical Alert: 10 Consecutive Failures</h2>
            <p>The Relier billing system has detected <strong>10 consecutive failed transactions</strong>.</p>

            <h3>Last Failed Transaction:</h3>
            <ul>
                <li><strong>Transaction ID:</strong> ${lastTransaction.transaction_id}</li>
                <li><strong>Customer:</strong> ${lastTransaction.customer_id}</li>
                <li><strong>Phone:</strong> ${lastTransaction.phone}</li>
                <li><strong>Amount:</strong> ${lastTransaction.amount_mxn || lastTransaction.amount} MXN</li>
                <li><strong>Time:</strong> ${new Date(lastTransaction.created_at).toLocaleString()}</li>
                <li><strong>Error:</strong> ${lastTransaction.latcom_response_message || 'Unknown error'}</li>
            </ul>

            <h3>⚠️ Action Required:</h3>
            <p>Please contact <strong>Latcom provider</strong> immediately to investigate the issue.</p>

            <p>View details: <a href="${process.env.BASE_URL || 'https://latcom-fix-production.up.railway.app'}/monitor">Monitoring Dashboard</a></p>

            <hr>
            <p style="color: #666; font-size: 0.9em;">This is an automated alert from Relier Billing System</p>
        `;

        const textBody = `
🚨 ALERT: 10 Consecutive Transaction Failures

The Relier billing system has detected 10 consecutive failed transactions.

Last Failed Transaction:
- Transaction ID: ${lastTransaction.transaction_id}
- Customer: ${lastTransaction.customer_id}
- Phone: ${lastTransaction.phone}
- Amount: ${lastTransaction.amount_mxn || lastTransaction.amount} MXN
- Time: ${new Date(lastTransaction.created_at).toLocaleString()}
- Error: ${lastTransaction.latcom_response_message || 'Unknown error'}

⚠️ Action Required:
Please contact Latcom provider immediately to investigate the issue.

View dashboard: ${process.env.BASE_URL || 'https://latcom-fix-production.up.railway.app'}/monitor
        `;

        await this.sendEmail(subject, htmlBody, textBody);
    }

    /**
     * Check balance and alert if low
     */
    async checkLowBalance(customerId, customerName, currentBalance, threshold = 1000) {
        if (currentBalance > threshold) {
            // Balance is okay, clear any previous alert
            delete this.lastBalanceAlerts[customerId];
            return;
        }

        // Check if we already alerted in the last 24 hours
        const lastAlert = this.lastBalanceAlerts[customerId];
        if (lastAlert && (Date.now() - lastAlert) < 24 * 60 * 60 * 1000) {
            return; // Already alerted recently
        }

        // Send alert
        await this.sendLowBalanceAlert(customerId, customerName, currentBalance, threshold);

        // Track that we sent the alert
        this.lastBalanceAlerts[customerId] = Date.now();
    }

    /**
     * Send low balance alert
     */
    async sendLowBalanceAlert(customerId, customerName, currentBalance, threshold) {
        const subject = `⚠️ Low Balance Alert: ${customerName} - $${currentBalance.toFixed(2)} USD`;

        const htmlBody = `
            <h2 style="color: #f59e0b;">⚠️ Low Balance Alert</h2>
            <p>Customer <strong>${customerName}</strong> has reached the low balance threshold.</p>

            <h3>Balance Details:</h3>
            <ul>
                <li><strong>Customer ID:</strong> ${customerId}</li>
                <li><strong>Company:</strong> ${customerName}</li>
                <li><strong>Current Balance:</strong> <span style="color: #ef4444; font-size: 1.2em;">$${currentBalance.toFixed(2)} USD</span></li>
                <li><strong>Threshold:</strong> $${threshold.toFixed(2)} USD</li>
                <li><strong>Time:</strong> ${new Date().toLocaleString()}</li>
            </ul>

            <h3>💡 Action Required:</h3>
            <p>Please add credit to this customer's account to avoid service interruption.</p>

            <p>Manage account: <a href="${process.env.BASE_URL || 'https://latcom-fix-production.up.railway.app'}/admin">Admin Panel</a></p>

            <hr>
            <p style="color: #666; font-size: 0.9em;">This is an automated alert from Relier Billing System. You will receive this alert once per 24 hours while the balance remains low.</p>
        `;

        const textBody = `
⚠️ Low Balance Alert: ${customerName}

Customer ${customerName} has reached the low balance threshold.

Balance Details:
- Customer ID: ${customerId}
- Company: ${customerName}
- Current Balance: $${currentBalance.toFixed(2)} USD
- Threshold: $${threshold.toFixed(2)} USD
- Time: ${new Date().toLocaleString()}

💡 Action Required:
Please add credit to this customer's account to avoid service interruption.

Manage account: ${process.env.BASE_URL || 'https://latcom-fix-production.up.railway.app'}/admin
        `;

        await this.sendEmail(subject, htmlBody, textBody);
    }

    /**
     * Test email configuration
     */
    async testEmail() {
        if (!this.transporter || !this.alertEmail) {
            return { success: false, error: 'Email not configured' };
        }

        try {
            const subject = '✅ Relier Alert System Test';
            const htmlBody = `
                <h2>✅ Alert System Working!</h2>
                <p>This is a test email from your Relier Billing alert system.</p>
                <p>Time: ${new Date().toLocaleString()}</p>
                <p>All alerts are configured and ready to send.</p>
            `;
            const textBody = `Alert System Test - ${new Date().toLocaleString()}`;

            await this.sendEmail(subject, htmlBody, textBody);
            return { success: true, message: 'Test email sent successfully' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Check if alerts are configured
     */
    isConfigured() {
        return !!(this.transporter && this.alertEmail);
    }
}

module.exports = new AlertSystem();
