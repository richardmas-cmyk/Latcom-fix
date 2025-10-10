const express = require('express');
const { createPool } = require('./database-config');
const { router: providerRouter } = require('./providers');
const latcomAPI = require('./latcom-api'); // Keep for backwards compatibility
const redisCache = require('./redis-cache');
const queueProcessor = require('./queue-processor');
const forexConverter = require('./forex-converter');
const alertSystem = require('./alert-system');
const path = require('path');
const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const { body, validationResult } = require('express-validator');
const morgan = require('morgan');
const fs = require('fs');

const app = express();

// Security constants - must be defined before use in validators
const MAX_TOPUP_AMOUNT = 500; // MXN
const DAILY_LIMIT_PER_CUSTOMER = 5000; // MXN

// Request logging with morgan
const accessLogStream = fs.createWriteStream(
    path.join(__dirname, 'access.log'),
    { flags: 'a' }
);
app.use(morgan('combined', { stream: accessLogStream }));
app.use(morgan('dev')); // Console logging

app.use(express.json());
app.use(express.static('views'));

// Rate limiters with Redis support
const rateLimiterConfig = {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 300, // 300 requests per window (increased for admin dashboards)
    message: { success: false, error: 'Too many requests, please try again later' },
    standardHeaders: true,
    legacyHeaders: false,
};

// Add Redis store if available
if (process.env.REDIS_URL && redisCache.isAvailable()) {
    rateLimiterConfig.store = new RedisStore({
        client: redisCache.client,
        prefix: 'rl:api:'
    });
    console.log('✅ Rate limiting using Redis');
} else {
    console.log('⚠️  Rate limiting using memory (less accurate for multiple instances)');
}

const apiLimiter = rateLimit(rateLimiterConfig);

const topupLimiterConfig = {
    windowMs: 60 * 1000, // 1 minute
    max: 200, // Increased from 10 to 200 per minute per customer (for 700K/day volume)
    keyGenerator: (req) => {
        // Use customer ID for rate limiting (more accurate than IP)
        return req.headers['x-customer-id'] || 'anonymous';
    },
    message: { success: false, error: 'Too many topup requests. Maximum 200 per minute.' },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => !req.headers['x-customer-id'], // Skip rate limit if no customer ID
};

// Add Redis store if available
if (process.env.REDIS_URL && redisCache.isAvailable()) {
    topupLimiterConfig.store = new RedisStore({
        client: redisCache.client,
        prefix: 'rl:topup:'
    });
}

const topupLimiter = rateLimit(topupLimiterConfig);

// Apply general rate limiting to all API routes
app.use('/api/', apiLimiter);

// Initialize database connection
let pool = createPool();
let dbConnected = false;

// Test database connection
async function testDatabase() {
    if (!pool) return false;
    
    try {
        const result = await pool.query('SELECT NOW()');
        console.log('✅ Database connected:', result.rows[0].now);
        dbConnected = true;
        return true;
    } catch (error) {
        console.log('❌ Database connection failed:', error.message);
        dbConnected = false;
        return false;
    }
}

// Initialize database tables
async function initDatabase() {
    if (!dbConnected) return;

    try {
        // Migrate existing transactions table to add forex columns
        try {
            await pool.query(`
                ALTER TABLE transactions
                ADD COLUMN IF NOT EXISTS amount_mxn DECIMAL(10,2),
                ADD COLUMN IF NOT EXISTS amount_usd DECIMAL(10,4),
                ADD COLUMN IF NOT EXISTS exchange_rate DECIMAL(10,6),
                ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'MXN'
            `);
            console.log('✅ Database migration: Added forex columns to transactions table');
        } catch (migrationError) {
            console.log('⚠️  Migration note:', migrationError.message);
        }

        // Migrate customers table to add discount field
        try {
            await pool.query(`
                ALTER TABLE customers
                ADD COLUMN IF NOT EXISTS commission_percentage DECIMAL(5,2) DEFAULT 0.00
            `);
            console.log('✅ Database migration: Added commission_percentage to customers table');
        } catch (migrationError) {
            console.log('⚠️  Migration note:', migrationError.message);
        }

        // Migrate transactions table to add response time tracking
        try {
            await pool.query(`
                ALTER TABLE transactions
                ADD COLUMN IF NOT EXISTS response_time_ms INTEGER,
                ADD COLUMN IF NOT EXISTS latcom_response_code VARCHAR(50),
                ADD COLUMN IF NOT EXISTS latcom_response_message TEXT
            `);
            console.log('✅ Database migration: Added response time tracking to transactions table');
        } catch (migrationError) {
            console.log('⚠️  Migration note:', migrationError.message);
        }

        // Migrate transactions table to add provider tracking (multi-provider support)
        try {
            await pool.query(`
                ALTER TABLE transactions
                ADD COLUMN IF NOT EXISTS provider VARCHAR(20) DEFAULT 'latcom',
                ADD COLUMN IF NOT EXISTS provider_transaction_id VARCHAR(100),
                ADD COLUMN IF NOT EXISTS transaction_type VARCHAR(20) DEFAULT 'topup'
            `);
            console.log('✅ Database migration: Added provider tracking to transactions table');
        } catch (migrationError) {
            console.log('⚠️  Migration note:', migrationError.message);
        }

        // Create tables
        await pool.query(`
            CREATE TABLE IF NOT EXISTS customers (
                id SERIAL PRIMARY KEY,
                customer_id VARCHAR(50) UNIQUE NOT NULL,
                company_name VARCHAR(255),
                api_key VARCHAR(255),
                secret_key VARCHAR(255),
                credit_limit DECIMAL(10,2) DEFAULT 10000,
                current_balance DECIMAL(10,2) DEFAULT 10000,
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT NOW()
            )
        `);
        
        await pool.query(`
            CREATE TABLE IF NOT EXISTS transactions (
                id SERIAL PRIMARY KEY,
                transaction_id VARCHAR(50) UNIQUE NOT NULL,
                customer_id VARCHAR(50),
                phone VARCHAR(20),
                amount DECIMAL(10,2),
                fee DECIMAL(10,2) DEFAULT 0,
                status VARCHAR(20),
                reference VARCHAR(100),
                operator_transaction_id VARCHAR(100),
                amount_mxn DECIMAL(10,2),
                amount_usd DECIMAL(10,4),
                exchange_rate DECIMAL(10,6),
                currency VARCHAR(10) DEFAULT 'MXN',
                created_at TIMESTAMP DEFAULT NOW(),
                processed_at TIMESTAMP
            )
        `);
        
        await pool.query(`
            CREATE TABLE IF NOT EXISTS billing_records (
                id SERIAL PRIMARY KEY,
                customer_id VARCHAR(50),
                transaction_id VARCHAR(50),
                amount DECIMAL(10,2),
                type VARCHAR(20), -- 'debit' or 'credit'
                balance_before DECIMAL(10,2),
                balance_after DECIMAL(10,2),
                created_at TIMESTAMP DEFAULT NOW()
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS invoices (
                id SERIAL PRIMARY KEY,
                invoice_number VARCHAR(50) UNIQUE NOT NULL,
                customer_id VARCHAR(50),
                date_from TIMESTAMP,
                date_to TIMESTAMP,
                subtotal DECIMAL(10,2),
                commission_percentage DECIMAL(5,2),
                discount_amount DECIMAL(10,2),
                total DECIMAL(10,2),
                transaction_count INTEGER,
                status VARCHAR(20) DEFAULT 'DRAFT',
                notes TEXT,
                created_at TIMESTAMP DEFAULT NOW(),
                generated_by VARCHAR(50)
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS invoice_items (
                id SERIAL PRIMARY KEY,
                invoice_number VARCHAR(50),
                transaction_id VARCHAR(50),
                description TEXT,
                amount DECIMAL(10,2),
                created_at TIMESTAMP DEFAULT NOW()
            )
        `);

        // Check/Create EnviaDespensa customer
        const exists = await pool.query(
            'SELECT * FROM customers WHERE customer_id = $1',
            ['ENVIADESPENSA_001']
        );
        
        if (exists.rows.length === 0) {
            await pool.query(`
                INSERT INTO customers 
                (customer_id, company_name, api_key, secret_key, credit_limit, current_balance) 
                VALUES ($1, $2, $3, $4, $5, $6)
            `, [
                'ENVIADESPENSA_001',
                'EnviaDespensa',
                'enviadespensa_prod_2025',
                'ENV!desp3ns4#2025',
                10000,
                10000
            ]);
            console.log('✅ EnviaDespensa customer created with $10,000 credit');
        } else {
            console.log('✅ EnviaDespensa exists. Balance: $' + exists.rows[0].current_balance);
        }
        
        console.log('✅ Database tables initialized');
    } catch (error) {
        console.error('❌ Database init error:', error.message);
    }
}

// ENDPOINTS
app.get('/health', async (req, res) => {
    try {
        const health = {
            status: 'OK',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            mode: dbConnected ? 'PRODUCTION' : 'TEST_MODE',
            services: {}
        };

        // Database status
        health.services.database = {
            connected: dbConnected,
            status: dbConnected ? 'healthy' : 'disconnected',
            pool: {
                max: 100,
                min: 10
            }
        };

        // Redis status
        health.services.redis = {
            connected: redisCache.isAvailable(),
            status: redisCache.isAvailable() ? 'healthy' : 'not configured'
        };

        // Queue status
        if (queueProcessor.isAvailable()) {
            const queueStats = await queueProcessor.getQueueStats();
            health.services.queue = {
                connected: true,
                status: 'healthy',
                stats: queueStats
            };
        } else {
            health.services.queue = {
                connected: false,
                status: 'not configured'
            };
        }

        // Rate limiting info
        health.services.rateLimiting = {
            backend: redisCache.isAvailable() ? 'redis' : 'memory',
            apiLimit: '300 per 15 minutes',
            topupLimit: '200 per minute per customer'
        };

        // Set overall health status
        const allHealthy = health.services.database.connected && health.services.redis.connected;
        if (!allHealthy) {
            health.status = 'DEGRADED';
        }

        res.json(health);

    } catch (error) {
        res.status(500).json({
            status: 'ERROR',
            error: error.message
        });
    }
});

app.get('/api/check-ip', async (req, res) => {
    try {
        const axios = require('axios');
        const response = await axios.get('https://api.ipify.org?format=json');
        res.json({
            outbound_ip: response.data.ip,
            message: 'This is the IP that external APIs see'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// TWILIO INTEGRATION
// ============================================
const twilioService = require('./lib/twilio-service');

// Twilio SMS Webhook (Incoming messages)
app.post('/webhook/twilio/sms', async (req, res) => {
    console.log('📱 [Twilio] Incoming SMS webhook:', req.body);

    try {
        // Parse incoming message
        const message = twilioService.parseIncomingMessage(req.body);
        console.log('📨 [Twilio] Message from:', message.from, 'Text:', message.message);

        // Generate auto-reply
        const reply = twilioService.generateAutoReply(message);

        // Send TwiML response
        const MessagingResponse = require('twilio').twiml.MessagingResponse;
        const twiml = new MessagingResponse();
        twiml.message(reply);

        res.type('text/xml');
        res.send(twiml.toString());

    } catch (error) {
        console.error('❌ [Twilio] SMS webhook error:', error.message);
        res.status(500).send('Error processing message');
    }
});

// Twilio WhatsApp Webhook (Incoming messages)
app.post('/webhook/twilio/whatsapp', async (req, res) => {
    console.log('💬 [Twilio] Incoming WhatsApp webhook:', req.body);

    try {
        // Parse incoming message
        const message = twilioService.parseIncomingMessage(req.body);
        console.log('💬 [Twilio] WhatsApp from:', message.from, 'Text:', message.message);

        // Generate auto-reply
        const reply = twilioService.generateAutoReply(message);

        // Send TwiML response
        const MessagingResponse = require('twilio').twiml.MessagingResponse;
        const twiml = new MessagingResponse();
        twiml.message(reply);

        res.type('text/xml');
        res.send(twiml.toString());

    } catch (error) {
        console.error('❌ [Twilio] WhatsApp webhook error:', error.message);
        res.status(500).send('Error processing message');
    }
});

// Twilio Status Callback (Message delivery status)
app.post('/webhook/twilio/status', async (req, res) => {
    console.log('📊 [Twilio] Status callback:', req.body);

    const { MessageSid, MessageStatus, To, ErrorCode } = req.body;

    if (ErrorCode) {
        console.error(`❌ [Twilio] Message ${MessageSid} to ${To} failed: ${ErrorCode}`);
    } else {
        console.log(`✅ [Twilio] Message ${MessageSid} to ${To} status: ${MessageStatus}`);
    }

    res.sendStatus(200);
});

// Test Twilio endpoint
app.post('/api/twilio/test', async (req, res) => {
    const { phone, message, channel = 'sms' } = req.body;

    if (!phone || !message) {
        return res.status(400).json({ error: 'Phone and message required' });
    }

    try {
        let result;
        if (channel === 'whatsapp') {
            result = await twilioService.sendWhatsApp(phone, message);
        } else {
            result = await twilioService.sendSMS(phone, message);
        }

        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Async topup endpoint with queue (RECOMMENDED - for high volume)
app.post('/api/enviadespensa/topup-async',
    topupLimiter, // Apply rate limiting
    // Input validation
    body('phone').notEmpty().withMessage('Phone number is required')
        .matches(/^[0-9]{10,15}$/).withMessage('Phone number must be 10-15 digits'),
    body('amount').isFloat({ min: 10, max: MAX_TOPUP_AMOUNT })
        .withMessage(`Amount must be between 10 and ${MAX_TOPUP_AMOUNT} MXN`),
    async (req, res) => {
    const apiKey = req.headers['x-api-key'];
    const customerId = req.headers['x-customer-id'];
    const { phone, amount, reference, provider } = req.body;

    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            error: 'Validation failed',
            details: errors.array()
        });
    }

    console.log(`📱 Async Topup request: ${phone} for $${amount}`);

    if (!dbConnected) {
        return res.status(503).json({ success: false, error: 'Database not available' });
    }

    if (!queueProcessor.isAvailable()) {
        // Fallback to sync processing if queue unavailable
        return res.status(503).json({
            success: false,
            error: 'Queue system not available - use /api/enviadespensa/topup endpoint'
        });
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Verify customer
        const custResult = await client.query(
            'SELECT * FROM customers WHERE api_key = $1 AND customer_id = $2 AND is_active = true',
            [apiKey, customerId]
        );

        if (custResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(401).json({
                success: false,
                error: 'Invalid API credentials'
            });
        }

        const customer = custResult.rows[0];

        // Check daily transaction limit
        const dailyTotalResult = await client.query(`
            SELECT COALESCE(SUM(amount_mxn), 0) as total
            FROM transactions
            WHERE customer_id = $1
            AND created_at > NOW() - INTERVAL '24 hours'
            AND status = 'SUCCESS'
        `, [customerId]);

        const dailyTotal = parseFloat(dailyTotalResult.rows[0].total);
        if (dailyTotal + parseFloat(amount) > DAILY_LIMIT_PER_CUSTOMER) {
            await client.query('ROLLBACK');
            return res.status(429).json({
                success: false,
                error: 'Daily transaction limit exceeded',
                daily_limit_mxn: DAILY_LIMIT_PER_CUSTOMER,
                used_today_mxn: dailyTotal,
                requested_mxn: parseFloat(amount),
                available_mxn: DAILY_LIMIT_PER_CUSTOMER - dailyTotal
            });
        }

        // Check balance
        if (parseFloat(customer.current_balance) < parseFloat(amount)) {
            await client.query('ROLLBACK');
            return res.status(403).json({
                success: false,
                error: 'Insufficient balance',
                current_balance: parseFloat(customer.current_balance),
                requested: parseFloat(amount)
            });
        }

        const transactionId = 'RLR' + Date.now();

        // Create transaction record with PENDING status
        await client.query(`
            INSERT INTO transactions
            (transaction_id, customer_id, phone, amount, status, reference, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, NOW())
        `, [transactionId, customerId, phone, amount, 'PENDING', reference || '']);

        await client.query('COMMIT');

        // Invalidate customer cache
        await redisCache.invalidateBalance(customerId);

        // Add job to queue
        const job = await queueProcessor.addTopupJob({
            customerId,
            phone,
            amount,
            reference: reference || transactionId,
            transactionId
        });

        console.log(`✅ Job ${job.id} queued for processing`);

        // Return immediately with transaction ID
        res.json({
            success: true,
            transaction: {
                id: transactionId,
                status: 'PENDING',
                amount: parseFloat(amount),
                phone: phone,
                reference: reference || '',
                queuedAt: new Date().toISOString(),
                currency: 'MXN'
            },
            message: 'Transaction queued for processing',
            check_status_url: `/api/transaction/${transactionId}`
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Queue topup error:', error);
        res.status(500).json({
            success: false,
            error: 'Transaction failed: ' + error.message
        });
    } finally {
        client.release();
    }
});

// Main topup endpoint with billing (SYNCHRONOUS - for compatibility)
app.post('/api/enviadespensa/topup',
    topupLimiter, // Apply rate limiting
    // Input validation
    body('phone').notEmpty().withMessage('Phone number is required')
        .matches(/^[0-9]{10,15}$/).withMessage('Phone number must be 10-15 digits'),
    body('amount').isFloat({ min: 10, max: MAX_TOPUP_AMOUNT })
        .withMessage(`Amount must be between 10 and ${MAX_TOPUP_AMOUNT} MXN`),
    async (req, res) => {
    const apiKey = req.headers['x-api-key'];
    const customerId = req.headers['x-customer-id'];
    const { phone, amount, reference, provider } = req.body;

    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            error: 'Validation failed',
            details: errors.array()
        });
    }

    console.log(`📱 Topup request: ${phone} for $${amount}`);

    // If no database, use TEST MODE
    if (!dbConnected) {
        if (apiKey === 'enviadespensa_prod_2025' && customerId === 'ENVIADESPENSA_001') {
            const transactionId = 'TEST_' + Date.now();
            return res.json({
                success: true,
                transaction: {
                    id: transactionId,
                    status: 'SUCCESS',
                    amount: amount,
                    phone: phone,
                    reference: reference,
                    operatorTransactionId: 'TEST_' + Math.random().toString(36).substring(7),
                    processedAt: new Date().toISOString(),
                    currency: 'MXN'
                },
                message: 'Test mode - no billing'
            });
        } else {
            return res.status(401).json({ success: false, error: 'Invalid credentials' });
        }
    }
    
    // PRODUCTION MODE with database
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        // Verify customer
        const custResult = await client.query(
            'SELECT * FROM customers WHERE api_key = $1 AND customer_id = $2 AND is_active = true',
            [apiKey, customerId]
        );
        
        if (custResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(401).json({ 
                success: false, 
                error: 'Invalid API credentials' 
            });
        }
        
        const customer = custResult.rows[0];

        // Check daily transaction limit
        const dailyTotalResult = await client.query(`
            SELECT COALESCE(SUM(amount_mxn), 0) as total
            FROM transactions
            WHERE customer_id = $1
            AND created_at > NOW() - INTERVAL '24 hours'
            AND status = 'SUCCESS'
        `, [customerId]);

        const dailyTotal = parseFloat(dailyTotalResult.rows[0].total);
        if (dailyTotal + parseFloat(amount) > DAILY_LIMIT_PER_CUSTOMER) {
            await client.query('ROLLBACK');
            return res.status(429).json({
                success: false,
                error: 'Daily transaction limit exceeded',
                daily_limit_mxn: DAILY_LIMIT_PER_CUSTOMER,
                used_today_mxn: dailyTotal,
                requested_mxn: parseFloat(amount),
                available_mxn: DAILY_LIMIT_PER_CUSTOMER - dailyTotal
            });
        }

        // Convert MXN to USD using real-time forex
        const forex = await forexConverter.convertMXNtoUSD(amount);
        const amountToDeduct = forex.amountUSD; // Deduct USD from balance

        console.log(`💱 Transaction: ${amount} MXN → $${amountToDeduct} USD (rate: ${forex.exchangeRate})`);

        // Check balance (customer balance is in USD)
        if (parseFloat(customer.current_balance) < amountToDeduct) {
            await client.query('ROLLBACK');
            return res.status(403).json({
                success: false,
                error: 'Insufficient balance',
                current_balance_usd: parseFloat(customer.current_balance),
                requested_mxn: parseFloat(amount),
                required_usd: amountToDeduct,
                exchange_rate: forex.exchangeRate
            });
        }

        const transactionId = 'RLR' + Date.now();
        const newBalance = parseFloat(customer.current_balance) - amountToDeduct;

        // Create transaction record with forex data
        await client.query(`
            INSERT INTO transactions
            (transaction_id, customer_id, phone, amount, status, reference,
             amount_mxn, amount_usd, exchange_rate, currency, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
        `, [transactionId, customerId, phone, amountToDeduct, 'PENDING', reference || '',
            forex.amountMXN, forex.amountUSD, forex.exchangeRate, 'MXN']);
        
        // Call Provider Router (multi-provider system with automatic failover)
        let providerResult;
        const startTime = Date.now();
        try {
            providerResult = await providerRouter.processTopup({
                phone: phone,
                amount: amount,
                reference: reference || transactionId,
                country: 'MEXICO',
                currency: 'MXN',
                preferredProvider: provider,  // Use specific provider if requested
                enableFailover: true  // Enable automatic failover to backup providers
            });
        } catch (error) {
            const responseTime = Date.now() - startTime;
            await client.query(
                'UPDATE transactions SET response_time_ms = $1, latcom_response_code = $2, latcom_response_message = $3, provider = $4 WHERE transaction_id = $5',
                [responseTime, 'ERROR', error.message, 'error', transactionId]
            );
            await client.query('ROLLBACK');
            return res.status(500).json({
                success: false,
                error: 'Provider error: ' + error.message
            });
        }
        const responseTime = Date.now() - startTime;

        if (providerResult.success) {
            const operatorId = providerResult.providerTransactionId || providerResult.operatorTransactionId;
            const provider = providerResult.provider || 'unknown';
            // Update customer balance
            await client.query(
                'UPDATE customers SET current_balance = $1 WHERE customer_id = $2',
                [newBalance, customerId]
            );

            // Create billing record (amount in USD)
            await client.query(`
                INSERT INTO billing_records
                (customer_id, transaction_id, amount, type, balance_before, balance_after)
                VALUES ($1, $2, $3, $4, $5, $6)
            `, [
                customerId,
                transactionId,
                amountToDeduct, // USD amount deducted
                'debit',
                customer.current_balance,
                newBalance
            ]);

            // Update transaction status with response time and provider info
            await client.query(
                `UPDATE transactions SET status = $1, operator_transaction_id = $2, processed_at = NOW(),
                 response_time_ms = $3, latcom_response_code = $4, latcom_response_message = $5,
                 provider = $6, provider_transaction_id = $7
                 WHERE transaction_id = $8`,
                ['SUCCESS', operatorId, responseTime, providerResult.success ? 'SUCCESS' : 'FAILED',
                 providerResult.message || 'Success', provider, operatorId, transactionId]
            );
            
            await client.query('COMMIT');

            console.log(`✅ Transaction ${transactionId} successful via ${provider.toUpperCase()}. Balance: $${customer.current_balance} → $${newBalance} USD`);

            // Reset failure counter on success
            alertSystem.resetFailureCounter();

            // Check for low balance alert
            await alertSystem.checkLowBalance(customerId, customer.company_name || customerId, newBalance, 1000);

            // Send SMS notification to customer - DISABLED
            // try {
            //     const twilioResult = await twilioService.sendTransactionNotification({
            //         phone: `+52${phone}`, // Add Mexico country code
            //         amount: amount,
            //         currency: 'MXN',
            //         status: 'SUCCESS',
            //         operatorTransactionId: operatorId,
            //         provider: provider
            //     }, ['sms']);

            //     if (twilioResult.sms?.success) {
            //         console.log(`📱 SMS notification sent to +52${phone} - Message SID: ${twilioResult.sms.messageSid}`);
            //     } else {
            //         console.log(`⚠️  SMS notification failed: ${twilioResult.sms?.error}`);
            //     }
            // } catch (smsError) {
            //     // Don't fail the transaction if SMS fails
            //     console.error(`❌ SMS notification error: ${smsError.message}`);
            // }
            console.log(`📱 SMS notifications paused - no message sent to +52${phone}`);

            res.json({
                success: true,
                transaction: {
                    id: transactionId,
                    status: 'SUCCESS',
                    amount_mxn: forex.amountMXN,
                    amount_usd: forex.amountUSD,
                    exchange_rate: forex.exchangeRate,
                    phone: phone,
                    reference: reference || '',
                    operatorTransactionId: operatorId,
                    provider: provider,
                    processedAt: new Date().toISOString(),
                    currency: 'MXN'
                },
                billing: {
                    deducted_usd: amountToDeduct,
                    balance_before_usd: parseFloat(customer.current_balance),
                    balance_after_usd: newBalance,
                    exchange_rate: forex.exchangeRate
                },
                message: `Top-up of ${amount} MXN processed successfully via ${provider}. $${amountToDeduct} USD deducted from balance.`,
                remaining_balance: newBalance
            });
        } else {
            // Provider failed - update transaction with failure details
            const provider = providerResult.provider || 'unknown';
            await client.query(
                `UPDATE transactions SET status = $1, response_time_ms = $2,
                 latcom_response_code = $3, latcom_response_message = $4, provider = $5, processed_at = NOW()
                 WHERE transaction_id = $6`,
                ['FAILED', responseTime, 'FAILED', providerResult.message, provider, transactionId]
            );

            // Track failure for consecutive failure alerts
            const failedTx = {
                transaction_id: transactionId,
                customer_id: customerId,
                phone: phone,
                amount_mxn: amount,
                amount: amount,
                created_at: new Date().toISOString(),
                latcom_response_message: providerResult.message,
                provider: provider
            };
            await alertSystem.trackTransactionFailure(failedTx);

            await client.query('ROLLBACK');
            return res.status(500).json({
                success: false,
                error: `Provider (${provider}) top-up failed: ` + providerResult.message,
                response_time_ms: responseTime,
                provider: provider
            });
        }
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Transaction error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Transaction failed: ' + error.message 
        });
    } finally {
        client.release();
    }
});

// Balance check endpoint (with Redis caching)
app.get('/api/balance', async (req, res) => {
    const apiKey = req.headers['x-api-key'];
    const customerId = req.headers['x-customer-id'];

    if (!dbConnected) {
        if (apiKey === 'enviadespensa_prod_2025' && customerId === 'ENVIADESPENSA_001') {
            return res.json({
                success: true,
                customer_id: 'ENVIADESPENSA_001',
                company_name: 'EnviaDespensa',
                current_balance: 10000,
                credit_limit: 10000,
                currency: 'MXN',
                mode: 'TEST_MODE'
            });
        } else {
            return res.status(401).json({ success: false, error: 'Invalid credentials' });
        }
    }

    try {
        // Try cache first
        const cached = await redisCache.getBalance(customerId);
        if (cached) {
            console.log(`💨 Cache hit for ${customerId}`);
            return res.json(cached);
        }

        // Cache miss - query database
        const result = await pool.query(
            'SELECT * FROM customers WHERE api_key = $1 AND customer_id = $2',
            [apiKey, customerId]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ success: false, error: 'Invalid credentials' });
        }

        const response = {
            success: true,
            customer_id: customerId,
            company_name: result.rows[0].company_name,
            current_balance: parseFloat(result.rows[0].current_balance),
            credit_limit: parseFloat(result.rows[0].credit_limit),
            currency: 'MXN'
        };

        // Cache the response
        await redisCache.setBalance(customerId, response);

        res.json(response);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Transaction status check endpoint
app.get('/api/transaction/:transactionId', async (req, res) => {
    const { transactionId } = req.params;

    if (!dbConnected) {
        return res.status(503).json({ success: false, error: 'Database not available' });
    }

    try {
        // Get from database
        const result = await pool.query(
            'SELECT * FROM transactions WHERE transaction_id = $1',
            [transactionId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Transaction not found' });
        }

        const tx = result.rows[0];

        // If still pending, check queue status
        if (tx.status === 'PENDING' && queueProcessor.isAvailable()) {
            const jobStatus = await queueProcessor.getJobStatus(transactionId);
            if (jobStatus) {
                tx.queue_status = jobStatus.state;
                tx.queue_progress = jobStatus.progress;
            }
        }

        res.json({
            success: true,
            transaction: tx
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Queue statistics endpoint
app.get('/api/queue/stats', async (req, res) => {
    if (!queueProcessor.isAvailable()) {
        return res.json({
            success: false,
            message: 'Queue system not available'
        });
    }

    try {
        const stats = await queueProcessor.getQueueStats();
        res.json({
            success: true,
            queue: stats,
            redis: redisCache.isAvailable()
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Admin endpoint to add credit
app.post('/api/admin/add-credit', async (req, res) => {
    const adminKey = req.headers['x-admin-key'];
    const { customer_id, amount } = req.body;

    if (adminKey !== process.env.ADMIN_KEY) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    if (!dbConnected) {
        return res.status(503).json({ success: false, error: 'Database not available' });
    }

    try {
        await pool.query(
            'UPDATE customers SET current_balance = current_balance + $1 WHERE customer_id = $2',
            [amount, customer_id]
        );

        // Invalidate cache
        await redisCache.invalidateBalance(customer_id);

        res.json({ success: true, message: 'Credit added successfully' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Phone number lookup (Admin only)
app.post('/api/admin/lookup-phone', async (req, res) => {
    const adminKey = req.headers['x-admin-key'];
    const { phone } = req.body;

    if (adminKey !== process.env.ADMIN_KEY) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    if (!phone) {
        return res.status(400).json({ success: false, error: 'Phone number required' });
    }

    try {
        const result = await latcomAPI.lookupPhone(phone);
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get transaction details with full log (Admin only)
app.get('/api/admin/transaction/:transactionId', async (req, res) => {
    const adminKey = req.headers['x-admin-key'];
    const { transactionId } = req.params;

    if (adminKey !== process.env.ADMIN_KEY) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    if (!dbConnected) {
        return res.status(503).json({ success: false, error: 'Database not available' });
    }

    try {
        // Get transaction from database
        const txnResult = await pool.query(
            'SELECT * FROM transactions WHERE transaction_id = $1',
            [transactionId]
        );

        if (txnResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Transaction not found' });
        }

        const transaction = txnResult.rows[0];

        // Get billing record
        const billingResult = await pool.query(
            'SELECT * FROM billing_records WHERE transaction_id = $1',
            [transactionId]
        );

        // Try to get Latcom status if we have operator transaction ID
        let latcomStatus = null;
        if (transaction.operator_transaction_id) {
            latcomStatus = await latcomAPI.getTransactionStatus(transaction.operator_transaction_id);
        }

        res.json({
            success: true,
            transaction: transaction,
            billing: billingResult.rows[0] || null,
            latcom_status: latcomStatus,
            logs: {
                created_at: transaction.created_at,
                processed_at: transaction.processed_at,
                status_history: [
                    { timestamp: transaction.created_at, status: 'PENDING', note: 'Transaction initiated' },
                    transaction.processed_at ? { timestamp: transaction.processed_at, status: transaction.status, note: 'Processed by Latcom' } : null
                ].filter(Boolean)
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Dashboard route
app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'dashboard.html'));
});

// Admin panel route
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'admin.html'));
});

// Real-time monitoring dashboard route
app.get('/monitor', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'monitor.html'));
});

// Queue monitor route
app.get('/queue', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'queue-monitor.html'));
});

// Testing dashboard route
app.get('/test', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'test-dashboard.html'));
});

// Test authentication endpoint
app.post('/api/test/auth', (req, res) => {
    const { key } = req.body;
    const testKey = process.env.TEST_KEY || 'relier_test_2025';

    if (key === testKey) {
        console.log('✅ [TEST] Authentication successful');
        res.json({ success: true, message: 'Authentication successful' });
    } else {
        console.log('❌ [TEST] Authentication failed - invalid key');
        res.status(401).json({ success: false, error: 'Invalid access key' });
    }
});

// Testing API endpoint with full logging
app.post('/api/test/topup', async (req, res) => {
    // Verify authentication
    const testKey = req.headers['x-test-key'];
    const validKey = process.env.TEST_KEY || 'relier_test_2025';

    if (!testKey || testKey !== validKey) {
        console.log('❌ [TEST] Unauthorized test attempt');
        return res.status(401).json({
            timestamp: new Date().toISOString(),
            error: 'Unauthorized - Invalid test key',
            success: false
        });
    }
    const startTime = Date.now();
    const timestamp = new Date().toISOString();

    const { phone, amount, provider = 'latcom' } = req.body;

    // Build request log
    const requestLog = {
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': 'enviadespensa_prod_2025',
            'x-customer-id': 'ENVIADESPENSA_001'
        },
        body: {
            phone: phone,
            amount: amount,
            reference: `TEST_${amount}_${Date.now()}`,
            provider: provider
        }
    };

    console.log('🧪 [TEST] Starting test topup:', JSON.stringify(requestLog, null, 2));

    try {
        // Make the actual topup request
        const axios = require('axios');
        const apiResponse = await axios.post(
            'https://latcom-fix-production.up.railway.app/api/enviadespensa/topup',
            requestLog.body,
            {
                headers: requestLog.headers,
                timeout: 30000
            }
        );

        const responseTime = Date.now() - startTime;

        console.log('✅ [TEST] Topup successful:', JSON.stringify(apiResponse.data, null, 2));

        // Return complete log
        res.json({
            timestamp: timestamp,
            request: {
                phone: phone,
                amount: amount,
                provider: provider,
                headers: requestLog.headers,
                body: requestLog.body
            },
            apiResponse: apiResponse.data,
            responseTime: responseTime,
            success: true
        });

    } catch (error) {
        const responseTime = Date.now() - startTime;

        console.error('❌ [TEST] Topup failed:', error.message);
        console.error('Error details:', error.response?.data || error.message);

        // Return error log
        res.json({
            timestamp: timestamp,
            request: {
                phone: phone,
                amount: amount,
                provider: provider,
                headers: requestLog.headers,
                body: requestLog.body
            },
            apiResponse: error.response?.data || null,
            error: error.response?.data?.error || error.message,
            responseTime: responseTime,
            success: false
        });
    }
});

// Get transactions for dashboard
app.get('/api/admin/transactions', async (req, res) => {
    const apiKey = req.headers['x-api-key'];
    const customerId = req.headers['x-customer-id'];

    if (!dbConnected) {
        return res.json({
            success: true,
            transactions: [],
            message: 'Test mode - no transactions yet'
        });
    }

    try {
        // Verify customer
        const custResult = await pool.query(
            'SELECT * FROM customers WHERE api_key = $1 AND customer_id = $2',
            [apiKey, customerId]
        );

        if (custResult.rows.length === 0) {
            return res.status(401).json({ success: false, error: 'Invalid credentials' });
        }

        // Get transactions
        const result = await pool.query(
            'SELECT * FROM transactions WHERE customer_id = $1 ORDER BY created_at DESC LIMIT 50',
            [customerId]
        );

        res.json({
            success: true,
            transactions: result.rows
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get all customers (admin only)
app.get('/api/admin/customers', async (req, res) => {
    const adminKey = req.headers['x-admin-key'];

    if (adminKey !== process.env.ADMIN_KEY) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    if (!dbConnected) {
        return res.status(503).json({ success: false, error: 'Database not available' });
    }

    try {
        const result = await pool.query('SELECT * FROM customers ORDER BY created_at DESC');
        res.json({ success: true, customers: result.rows });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get all transactions across all customers (admin only)
app.get('/api/admin/all-transactions', async (req, res) => {
    const adminKey = req.headers['x-admin-key'];

    if (adminKey !== process.env.ADMIN_KEY) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    if (!dbConnected) {
        return res.json({ success: true, transactions: [] });
    }

    try {
        const result = await pool.query(
            'SELECT * FROM transactions ORDER BY created_at DESC LIMIT 1000'
        );
        res.json({ success: true, transactions: result.rows });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update customer commission (Admin only)
app.post('/api/admin/update-commission', async (req, res) => {
    const adminKey = req.headers['x-admin-key'];
    const { customer_id, commission_percentage } = req.body;

    if (adminKey !== process.env.ADMIN_KEY) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    if (!dbConnected) {
        return res.status(503).json({ success: false, error: 'Database not connected' });
    }

    try {
        await pool.query(
            'UPDATE customers SET commission_percentage = $1 WHERE customer_id = $2',
            [commission_percentage, customer_id]
        );

        res.json({ success: true, message: 'Commission updated successfully' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Generate invoice (Admin only)
app.post('/api/admin/generate-invoice', async (req, res) => {
    const adminKey = req.headers['x-admin-key'];
    const { customer_id, date_from, date_to, notes } = req.body;

    if (adminKey !== process.env.ADMIN_KEY) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    if (!dbConnected) {
        return res.status(503).json({ success: false, error: 'Database not connected' });
    }

    try {
        // Get customer commission
        const customerResult = await pool.query(
            'SELECT commission_percentage, company_name FROM customers WHERE customer_id = $1',
            [customer_id]
        );

        if (customerResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Customer not found' });
        }

        const customer = customerResult.rows[0];
        const commissionPercentage = parseFloat(customer.commission_percentage) || 0;

        // Get transactions in date range
        const txResult = await pool.query(
            `SELECT * FROM transactions
             WHERE customer_id = $1
             AND created_at >= $2
             AND created_at <= $3
             AND status = 'SUCCESS'
             ORDER BY created_at ASC`,
            [customer_id, date_from, date_to]
        );

        const transactions = txResult.rows;

        if (transactions.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No successful transactions found in date range'
            });
        }

        // Calculate subtotal (sum of all USD amounts)
        const subtotal = transactions.reduce((sum, tx) => {
            const amount = tx.amount_usd ? parseFloat(tx.amount_usd) : parseFloat(tx.amount);
            return sum + amount;
        }, 0);

        // Calculate commission
        const commissionAmount = (subtotal * commissionPercentage) / 100;
        const total = subtotal + commissionAmount;

        // Generate invoice number
        const invoiceNumber = `INV-${customer_id}-${Date.now()}`;

        // Insert invoice
        await pool.query(
            `INSERT INTO invoices
            (invoice_number, customer_id, date_from, date_to, subtotal,
             commission_percentage, discount_amount, total, transaction_count,
             status, notes, generated_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
            [
                invoiceNumber, customer_id, date_from, date_to, subtotal.toFixed(2),
                commissionPercentage, commissionAmount.toFixed(2), total.toFixed(2),
                transactions.length, 'GENERATED', notes || '', 'ADMIN'
            ]
        );

        // Insert invoice items
        for (const tx of transactions) {
            const amount = tx.amount_usd ? parseFloat(tx.amount_usd) : parseFloat(tx.amount);
            const description = `Top-up ${tx.phone} - ${tx.amount_mxn || tx.amount} MXN`;

            await pool.query(
                `INSERT INTO invoice_items
                (invoice_number, transaction_id, description, amount)
                VALUES ($1, $2, $3, $4)`,
                [invoiceNumber, tx.transaction_id, description, amount.toFixed(2)]
            );
        }

        res.json({
            success: true,
            invoice_number: invoiceNumber,
            customer_name: customer.company_name,
            date_from,
            date_to,
            subtotal: subtotal.toFixed(2),
            commission_percentage: commissionPercentage,
            commission_amount: commissionAmount.toFixed(2),
            total: total.toFixed(2),
            transaction_count: transactions.length
        });

    } catch (error) {
        console.error('❌ Invoice generation error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get all invoices (Admin only)
app.get('/api/admin/invoices', async (req, res) => {
    const adminKey = req.headers['x-admin-key'];

    if (adminKey !== process.env.ADMIN_KEY) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    if (!dbConnected) {
        return res.json({ success: true, invoices: [] });
    }

    try {
        const result = await pool.query(
            `SELECT i.*, c.company_name
             FROM invoices i
             LEFT JOIN customers c ON i.customer_id = c.customer_id
             ORDER BY i.created_at DESC`
        );
        res.json({ success: true, invoices: result.rows });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get invoice details (Admin only)
app.get('/api/admin/invoice/:invoiceNumber', async (req, res) => {
    const adminKey = req.headers['x-admin-key'];
    const { invoiceNumber } = req.params;

    if (adminKey !== process.env.ADMIN_KEY) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    if (!dbConnected) {
        return res.status(404).json({ success: false, error: 'Database not connected' });
    }

    try {
        // Get invoice
        const invoiceResult = await pool.query(
            `SELECT i.*, c.company_name, c.commission_percentage as customer_commission
             FROM invoices i
             LEFT JOIN customers c ON i.customer_id = c.customer_id
             WHERE i.invoice_number = $1`,
            [invoiceNumber]
        );

        if (invoiceResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Invoice not found' });
        }

        // Get invoice items
        const itemsResult = await pool.query(
            'SELECT * FROM invoice_items WHERE invoice_number = $1 ORDER BY created_at ASC',
            [invoiceNumber]
        );

        res.json({
            success: true,
            invoice: invoiceResult.rows[0],
            items: itemsResult.rows
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get real-time system metrics (Admin only)
app.get('/api/admin/metrics', async (req, res) => {
    const adminKey = req.headers['x-admin-key'];

    if (adminKey !== process.env.ADMIN_KEY) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    if (!dbConnected) {
        return res.json({ success: true, metrics: {} });
    }

    try {
        // Average response time (last 100 transactions)
        const avgTimeResult = await pool.query(`
            SELECT AVG(response_time_ms) as avg_time,
                   MIN(response_time_ms) as min_time,
                   MAX(response_time_ms) as max_time
            FROM transactions
            WHERE response_time_ms IS NOT NULL
            AND created_at >= NOW() - INTERVAL '24 hours'
        `);

        // Success/Failure rates (last 24 hours)
        const statusResult = await pool.query(`
            SELECT status, COUNT(*) as count
            FROM transactions
            WHERE created_at >= NOW() - INTERVAL '24 hours'
            GROUP BY status
        `);

        // Transactions per hour (last 24 hours)
        const tphResult = await pool.query(`
            SELECT COUNT(*) as count
            FROM transactions
            WHERE created_at >= NOW() - INTERVAL '1 hour'
        `);

        // Last 10 transactions with response times
        const recentResult = await pool.query(`
            SELECT transaction_id, phone, amount_mxn, status, response_time_ms,
                   latcom_response_code, created_at
            FROM transactions
            WHERE response_time_ms IS NOT NULL
            ORDER BY created_at DESC
            LIMIT 10
        `);

        const avgTime = avgTimeResult.rows[0];
        const statusCounts = {};
        statusResult.rows.forEach(row => {
            statusCounts[row.status] = parseInt(row.count);
        });

        const totalTransactions = Object.values(statusCounts).reduce((sum, count) => sum + count, 0);
        const successRate = totalTransactions > 0 ? ((statusCounts.SUCCESS || 0) / totalTransactions * 100).toFixed(1) : 0;

        res.json({
            success: true,
            metrics: {
                average_response_time_ms: avgTime.avg_time ? parseFloat(avgTime.avg_time).toFixed(0) : null,
                min_response_time_ms: avgTime.min_time || null,
                max_response_time_ms: avgTime.max_time || null,
                transactions_last_hour: parseInt(tphResult.rows[0].count),
                transactions_last_24h: totalTransactions,
                success_rate_24h: parseFloat(successRate),
                status_counts: statusCounts,
                recent_transactions: recentResult.rows
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Test alert system (Admin only)
app.post('/api/admin/test-alert', async (req, res) => {
    const adminKey = req.headers['x-admin-key'];

    if (adminKey !== process.env.ADMIN_KEY) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    try {
        const result = await alertSystem.testEmail();
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get alert system status (Admin only)
app.get('/api/admin/alert-status', async (req, res) => {
    const adminKey = req.headers['x-admin-key'];

    if (adminKey !== process.env.ADMIN_KEY) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    res.json({
        success: true,
        configured: alertSystem.isConfigured(),
        alert_email: alertSystem.alertEmail || 'Not configured',
        consecutive_failures: alertSystem.consecutiveFailures,
        active_balance_alerts: Object.keys(alertSystem.lastBalanceAlerts).length
    });
});

// Delete invoice (Admin only)
app.delete('/api/admin/invoice/:invoiceNumber', async (req, res) => {
    const adminKey = req.headers['x-admin-key'];
    const { invoiceNumber } = req.params;

    if (adminKey !== process.env.ADMIN_KEY) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    if (!dbConnected) {
        return res.status(503).json({ success: false, error: 'Database not connected' });
    }

    try {
        // Delete invoice items first (foreign key constraint)
        await pool.query('DELETE FROM invoice_items WHERE invoice_number = $1', [invoiceNumber]);

        // Delete invoice
        const result = await pool.query('DELETE FROM invoices WHERE invoice_number = $1 RETURNING *', [invoiceNumber]);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Invoice not found' });
        }

        res.json({ success: true, message: 'Invoice deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update invoice commission (Admin only)
app.patch('/api/admin/invoice/:invoiceNumber', async (req, res) => {
    const adminKey = req.headers['x-admin-key'];
    const { invoiceNumber } = req.params;
    const { commission_percentage, notes } = req.body;

    if (adminKey !== process.env.ADMIN_KEY) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    if (!dbConnected) {
        return res.status(503).json({ success: false, error: 'Database not connected' });
    }

    try {
        // Get current invoice
        const invoiceResult = await pool.query('SELECT * FROM invoices WHERE invoice_number = $1', [invoiceNumber]);

        if (invoiceResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Invoice not found' });
        }

        const invoice = invoiceResult.rows[0];
        const subtotal = parseFloat(invoice.subtotal);

        // Recalculate if commission changed
        let newCommissionPercentage = commission_percentage !== undefined ? parseFloat(commission_percentage) : parseFloat(invoice.commission_percentage);
        let newCommissionAmount = (subtotal * newCommissionPercentage) / 100;
        let newTotal = subtotal + newCommissionAmount;

        // Update invoice
        await pool.query(
            `UPDATE invoices
             SET commission_percentage = $1,
                 discount_amount = $2,
                 total = $3,
                 notes = $4
             WHERE invoice_number = $5`,
            [newCommissionPercentage, newCommissionAmount.toFixed(2), newTotal.toFixed(2), notes || invoice.notes, invoiceNumber]
        );

        res.json({
            success: true,
            message: 'Invoice updated successfully',
            commission_percentage: newCommissionPercentage,
            commission_amount: newCommissionAmount.toFixed(2),
            total: newTotal.toFixed(2)
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==========================================
// RECONCILIATION ENDPOINTS
// ==========================================

// Get reconciliation portal
app.get('/reconcile', (req, res) => {
    res.sendFile(__dirname + '/views/reconcile.html');
});

// Get transactions for reconciliation with date range
app.get('/api/admin/reconcile', async (req, res) => {
    const reconcileKey = req.headers['x-reconcile-key'];
    // Accept either RECONCILE_KEY or ADMIN_KEY for backwards compatibility
    if (reconcileKey !== process.env.RECONCILE_KEY && reconcileKey !== process.env.ADMIN_KEY) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { date_from, date_to, status } = req.query;

    // RECONCILE_KEY can only see EnviaDespensa transactions
    const isReconcileKeyOnly = reconcileKey === process.env.RECONCILE_KEY && reconcileKey !== process.env.ADMIN_KEY;
    const customer_id = isReconcileKeyOnly ? 'ENVIADESPENSA_001' : req.query.customer_id;

    try {
        let query = `
            SELECT
                t.transaction_id,
                t.customer_id,
                t.phone,
                t.amount_mxn,
                t.status,
                t.created_at,
                t.response_time_ms,
                t.latcom_response_code,
                t.latcom_response_message,
                t.operator_transaction_id,
                c.company_name
            FROM transactions t
            LEFT JOIN customers c ON t.customer_id = c.customer_id
            WHERE 1=1
        `;

        const params = [];
        let paramCount = 1;

        if (date_from) {
            query += ` AND t.created_at >= $${paramCount}`;
            params.push(date_from);
            paramCount++;
        }

        if (date_to) {
            query += ` AND t.created_at <= $${paramCount}`;
            params.push(date_to);
            paramCount++;
        }

        if (customer_id) {
            query += ` AND t.customer_id = $${paramCount}`;
            params.push(customer_id);
            paramCount++;
        }

        if (status) {
            query += ` AND t.status = $${paramCount}`;
            params.push(status);
            paramCount++;
        }

        query += ` ORDER BY t.created_at DESC LIMIT 1000`;

        const result = await pool.query(query, params);

        // Calculate summary statistics
        const summary = {
            total_transactions: result.rows.length,
            total_mxn: result.rows.reduce((sum, t) => sum + parseFloat(t.amount_mxn || 0), 0),
            success_count: result.rows.filter(t => t.status === 'SUCCESS').length,
            failed_count: result.rows.filter(t => t.status === 'FAILED').length,
            pending_count: result.rows.filter(t => t.status === 'PENDING').length
        };

        res.json({
            success: true,
            transactions: result.rows,
            summary: summary
        });

    } catch (error) {
        console.error('Reconciliation error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get reconciliation summary by date
app.get('/api/admin/reconcile/summary', async (req, res) => {
    const reconcileKey = req.headers['x-reconcile-key'];
    if (reconcileKey !== process.env.RECONCILE_KEY && reconcileKey !== process.env.ADMIN_KEY) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { date_from, date_to } = req.query;

    // RECONCILE_KEY can only see EnviaDespensa transactions
    const isReconcileKeyOnly = reconcileKey === process.env.RECONCILE_KEY && reconcileKey !== process.env.ADMIN_KEY;

    try {
        let query = `
            SELECT
                DATE(created_at) as date,
                COUNT(*) as total_transactions,
                SUM(CASE WHEN status = 'SUCCESS' THEN 1 ELSE 0 END) as success_count,
                SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) as failed_count,
                SUM(amount_mxn) as total_mxn,
                AVG(response_time_ms) as avg_response_time
            FROM transactions
            WHERE created_at >= $1 AND created_at <= $2
        `;

        // Restrict to EnviaDespensa only if using RECONCILE_KEY
        if (isReconcileKeyOnly) {
            query += ` AND customer_id = 'ENVIADESPENSA_001'`;
        }

        query += `
            GROUP BY DATE(created_at)
            ORDER BY date DESC
        `;

        const result = await pool.query(query, [date_from || '2025-01-01', date_to || '2025-12-31']);

        res.json({
            success: true,
            daily_summary: result.rows
        });

    } catch (error) {
        console.error('Summary error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Export reconciliation data to CSV
app.get('/api/admin/reconcile/export', async (req, res) => {
    const reconcileKey = req.headers['x-reconcile-key'];
    if (reconcileKey !== process.env.RECONCILE_KEY && reconcileKey !== process.env.ADMIN_KEY) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { date_from, date_to } = req.query;

    // RECONCILE_KEY can only see EnviaDespensa transactions
    const isReconcileKeyOnly = reconcileKey === process.env.RECONCILE_KEY && reconcileKey !== process.env.ADMIN_KEY;
    const customer_id = isReconcileKeyOnly ? 'ENVIADESPENSA_001' : req.query.customer_id;

    try {
        let query = `
            SELECT
                t.transaction_id,
                t.customer_id,
                c.company_name,
                t.phone,
                t.amount_mxn,
                t.status,
                t.created_at,
                t.response_time_ms,
                t.latcom_response_code,
                t.latcom_response_message,
                t.operator_transaction_id
            FROM transactions t
            LEFT JOIN customers c ON t.customer_id = c.customer_id
            WHERE 1=1
        `;

        const params = [];
        let paramCount = 1;

        if (date_from) {
            query += ` AND t.created_at >= $${paramCount}`;
            params.push(date_from);
            paramCount++;
        }

        if (date_to) {
            query += ` AND t.created_at <= $${paramCount}`;
            params.push(date_to);
            paramCount++;
        }

        if (customer_id) {
            query += ` AND t.customer_id = $${paramCount}`;
            params.push(customer_id);
            paramCount++;
        }

        query += ` ORDER BY t.created_at DESC`;

        const result = await pool.query(query, params);

        // Generate CSV
        let csv = 'Transaction ID,Customer ID,Company,Phone,Amount MXN,Status,Date,Response Time (ms),Latcom Code,Latcom Message,Operator TX ID\n';

        result.rows.forEach(row => {
            csv += `"${row.transaction_id}","${row.customer_id}","${row.company_name || ''}","${row.phone}",${row.amount_mxn},"${row.status}","${row.created_at}",${row.response_time_ms || ''},"${row.latcom_response_code || ''}","${row.latcom_response_message || ''}","${row.operator_transaction_id || ''}"\n`;
        });

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=reconciliation_${date_from}_to_${date_to}.csv`);
        res.send(csv);

    } catch (error) {
        console.error('Export error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==========================================
// LATCOM PRODUCT CATALOG ENDPOINTS
// ==========================================

const { getAllProducts, getProductById } = require('./products');

// Get all available products
app.get('/api/admin/products', (req, res) => {
    const adminKey = req.headers['x-admin-key'];
    if (adminKey !== process.env.ADMIN_KEY) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    try {
        const products = getAllProducts();
        res.json({ success: true, products });
    } catch (error) {
        console.error('Get products error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Test a specific product
app.post('/api/admin/test-product', async (req, res) => {
    const adminKey = req.headers['x-admin-key'];
    if (adminKey !== process.env.ADMIN_KEY) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { productId, phone } = req.body;

    try {
        const product = getProductById(productId);
        if (!product) {
            return res.status(400).json({ success: false, error: 'Product not found' });
        }

        // Use latcom-api to test the product
        const result = await latcomAPI.testProduct(phone, product);
        res.json(result);
    } catch (error) {
        console.error('Test product error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==========================================
// MUWE WEBHOOK ENDPOINTS
// ==========================================

const crypto = require('crypto');

/**
 * Verify MUWE webhook signature
 */
function verifyMUWESignature(payload, receivedSignature) {
    const secretKey = process.env.MUWE_SECRET_KEY || 'ZtIPVopZCwxLiJgrs68MPgNOorWx9CzT';

    // Remove sign field from payload
    const { sign, ...paramsToSign } = payload;

    // Sort keys alphabetically
    const sortedKeys = Object.keys(paramsToSign).sort();

    // Build signature string
    const stringA = sortedKeys
        .filter(key => paramsToSign[key] !== null && paramsToSign[key] !== undefined && paramsToSign[key] !== '')
        .map(key => `${key}=${paramsToSign[key]}`)
        .join('&');

    const stringSignTemp = `${stringA}&key=${secretKey}`;
    const calculatedSign = crypto.createHash('md5').update(stringSignTemp).digest('hex').toUpperCase();

    console.log(`[MUWE Webhook] Calculated signature: ${calculatedSign}`);
    console.log(`[MUWE Webhook] Received signature: ${receivedSignature}`);

    return calculatedSign === receivedSignature;
}

/**
 * MUWE OXXO Payment Webhook
 * Called when customer completes payment at OXXO store
 */
app.post('/webhook/muwe/oxxo', async (req, res) => {
    try {
        console.log('📩 [MUWE Webhook] OXXO payment notification received:', JSON.stringify(req.body, null, 2));

        const payload = req.body;

        // Verify signature
        if (!verifyMUWESignature(payload, payload.sign)) {
            console.error('❌ [MUWE Webhook] Invalid signature');
            return res.status(401).json({ resCode: 'FAIL', errDes: 'Invalid signature' });
        }

        console.log('✅ [MUWE Webhook] Signature verified');

        // Extract payment details
        const {
            mchOrderNo,     // Our order number
            state,          // Payment state: 2 = success
            amount,         // Amount in cents
            payTime,        // Payment timestamp
            orderId         // MUWE order ID
        } = payload;

        // Update transaction in database if exists
        if (dbConnected && mchOrderNo) {
            try {
                // Find transaction by reference
                const txResult = await client.query(
                    'SELECT * FROM transactions WHERE reference = $1',
                    [mchOrderNo]
                );

                if (txResult.rows.length > 0) {
                    const transaction = txResult.rows[0];

                    if (state === 2) {
                        // Payment successful
                        await client.query(
                            `UPDATE transactions SET
                            status = 'SUCCESS',
                            provider_transaction_id = $1,
                            processed_at = $2,
                            latcom_response_message = 'OXXO payment completed'
                            WHERE transaction_id = $3`,
                            [orderId, new Date(payTime * 1000), transaction.transaction_id]
                        );

                        console.log(`✅ [MUWE Webhook] Transaction ${mchOrderNo} marked as SUCCESS`);
                    } else {
                        console.log(`⚠️  [MUWE Webhook] Payment state: ${state} (not success)`);
                    }
                }
            } catch (dbError) {
                console.error('❌ [MUWE Webhook] Database update error:', dbError.message);
            }
        }

        // Respond to MUWE
        res.json({ resCode: 'SUCCESS' });

    } catch (error) {
        console.error('❌ [MUWE Webhook] Error processing OXXO webhook:', error.message);
        res.status(500).json({ resCode: 'FAIL', errDes: error.message });
    }
});

/**
 * MUWE SPEI Transfer Webhook
 * Called when SPEI transfer is completed
 */
app.post('/webhook/muwe/spei', async (req, res) => {
    try {
        console.log('📩 [MUWE Webhook] SPEI transfer notification received:', JSON.stringify(req.body, null, 2));

        const payload = req.body;

        // Verify signature
        if (!verifyMUWESignature(payload, payload.sign)) {
            console.error('❌ [MUWE Webhook] Invalid signature');
            return res.status(401).json({ resCode: 'FAIL', errDes: 'Invalid signature' });
        }

        console.log('✅ [MUWE Webhook] Signature verified');

        const {
            mchOrderNo,
            state,
            amount,
            payTime,
            orderId
        } = payload;

        // Update transaction in database if exists
        if (dbConnected && mchOrderNo) {
            try {
                const txResult = await client.query(
                    'SELECT * FROM transactions WHERE reference = $1',
                    [mchOrderNo]
                );

                if (txResult.rows.length > 0) {
                    const transaction = txResult.rows[0];

                    if (state === 2) {
                        await client.query(
                            `UPDATE transactions SET
                            status = 'SUCCESS',
                            provider_transaction_id = $1,
                            processed_at = $2,
                            latcom_response_message = 'SPEI transfer completed'
                            WHERE transaction_id = $3`,
                            [orderId, new Date(payTime * 1000), transaction.transaction_id]
                        );

                        console.log(`✅ [MUWE Webhook] SPEI transaction ${mchOrderNo} marked as SUCCESS`);
                    }
                }
            } catch (dbError) {
                console.error('❌ [MUWE Webhook] Database update error:', dbError.message);
            }
        }

        res.json({ resCode: 'SUCCESS' });

    } catch (error) {
        console.error('❌ [MUWE Webhook] Error processing SPEI webhook:', error.message);
        res.status(500).json({ resCode: 'FAIL', errDes: error.message });
    }
});

/**
 * Generic MUWE Webhook Handler
 * Catches all other MUWE notifications
 */
app.post('/webhook/muwe', async (req, res) => {
    try {
        console.log('📩 [MUWE Webhook] Generic notification received:', JSON.stringify(req.body, null, 2));

        const payload = req.body;

        // Verify signature
        if (payload.sign && !verifyMUWESignature(payload, payload.sign)) {
            console.error('❌ [MUWE Webhook] Invalid signature');
            return res.status(401).json({ resCode: 'FAIL', errDes: 'Invalid signature' });
        }

        console.log('✅ [MUWE Webhook] Notification processed');

        res.json({ resCode: 'SUCCESS' });

    } catch (error) {
        console.error('❌ [MUWE Webhook] Error processing webhook:', error.message);
        res.status(500).json({ resCode: 'FAIL', errDes: error.message });
    }
});

// Start server
const PORT = process.env.PORT || 8080;

console.log('🚀 Starting Relier Hub - Multi-Provider Payment System...');
console.log('📦 Providers: Latcom, PPN (Valuetop), CSQ, MUWE');
const configuredProviders = providerRouter.getConfiguredProviders();
console.log(`✅ ${configuredProviders.length} provider(s) configured and ready`);
console.log('📧 Alert system configured:', alertSystem.isConfigured() ? 'YES' : 'NO');

testDatabase().then(() => {
    initDatabase().then(() => {
        app.listen(PORT, () => {
            console.log(`✅ Server running on port ${PORT}`);
            console.log(`📊 Mode: ${dbConnected ? 'PRODUCTION with billing' : 'TEST MODE without billing'}`);
            console.log('🎯 EnviaDespensa ready to test!');
        });
    });
});
