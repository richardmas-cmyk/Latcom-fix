const express = require('express');
const { createPool } = require('./database-config');
const latcomAPI = require('./latcom-api');
const redisCache = require('./redis-cache');
const queueProcessor = require('./queue-processor');
const forexConverter = require('./forex-converter');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static('views'));

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
                ADD COLUMN IF NOT EXISTS discount_percentage DECIMAL(5,2) DEFAULT 0.00
            `);
            console.log('✅ Database migration: Added discount_percentage to customers table');
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
                discount_percentage DECIMAL(5,2),
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
    const dbStatus = dbConnected ? 'connected' : 'not connected';
    res.json({ 
        status: 'OK',
        mode: dbConnected ? 'PRODUCTION' : 'TEST_MODE',
        database: dbStatus,
        message: 'API is running'
    });
});

// Async topup endpoint with queue (RECOMMENDED - for high volume)
app.post('/api/enviadespensa/topup-async', async (req, res) => {
    const apiKey = req.headers['x-api-key'];
    const customerId = req.headers['x-customer-id'];
    const { phone, amount, reference } = req.body;

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
app.post('/api/enviadespensa/topup', async (req, res) => {
    const apiKey = req.headers['x-api-key'];
    const customerId = req.headers['x-customer-id'];
    const { phone, amount, reference } = req.body;
    
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
        
        // Call real Latcom API
        let latcomResult;
        try {
            latcomResult = await latcomAPI.topup(phone, amount, reference);
        } catch (error) {
            await client.query('ROLLBACK');
            return res.status(500).json({
                success: false,
                error: 'Latcom API error: ' + error.message
            });
        }

        if (latcomResult.success) {
            const operatorId = latcomResult.operatorTransactionId;
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
            
            // Update transaction status
            await client.query(
                'UPDATE transactions SET status = $1, operator_transaction_id = $2, processed_at = NOW() WHERE transaction_id = $3',
                ['SUCCESS', operatorId, transactionId]
            );
            
            await client.query('COMMIT');
            
            console.log(`✅ Transaction ${transactionId} successful. Balance: $${customer.current_balance} → $${newBalance} USD`);

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
                    processedAt: new Date().toISOString(),
                    currency: 'MXN'
                },
                billing: {
                    deducted_usd: amountToDeduct,
                    balance_before_usd: parseFloat(customer.current_balance),
                    balance_after_usd: newBalance,
                    exchange_rate: forex.exchangeRate
                },
                message: `Top-up of ${amount} MXN processed successfully. $${amountToDeduct} USD deducted from balance.`,
                remaining_balance: newBalance
            });
        } else {
            // Latcom failed - rollback transaction
            await client.query('ROLLBACK');
            return res.status(500).json({
                success: false,
                error: 'Latcom top-up failed: ' + latcomResult.message
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

// Queue monitor route
app.get('/queue', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'queue-monitor.html'));
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

// Update customer discount (Admin only)
app.post('/api/admin/update-discount', async (req, res) => {
    const adminKey = req.headers['x-admin-key'];
    const { customer_id, discount_percentage } = req.body;

    if (adminKey !== process.env.ADMIN_KEY) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    if (!dbConnected) {
        return res.status(503).json({ success: false, error: 'Database not connected' });
    }

    try {
        await pool.query(
            'UPDATE customers SET discount_percentage = $1 WHERE customer_id = $2',
            [discount_percentage, customer_id]
        );

        res.json({ success: true, message: 'Discount updated successfully' });
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
        // Get customer discount
        const customerResult = await pool.query(
            'SELECT discount_percentage, company_name FROM customers WHERE customer_id = $1',
            [customer_id]
        );

        if (customerResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Customer not found' });
        }

        const customer = customerResult.rows[0];
        const discountPercentage = parseFloat(customer.discount_percentage) || 0;

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

        // Calculate discount
        const discountAmount = (subtotal * discountPercentage) / 100;
        const total = subtotal - discountAmount;

        // Generate invoice number
        const invoiceNumber = `INV-${customer_id}-${Date.now()}`;

        // Insert invoice
        await pool.query(
            `INSERT INTO invoices
            (invoice_number, customer_id, date_from, date_to, subtotal,
             discount_percentage, discount_amount, total, transaction_count,
             status, notes, generated_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
            [
                invoiceNumber, customer_id, date_from, date_to, subtotal.toFixed(2),
                discountPercentage, discountAmount.toFixed(2), total.toFixed(2),
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
            discount_percentage: discountPercentage,
            discount_amount: discountAmount.toFixed(2),
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
            `SELECT i.*, c.company_name, c.discount_percentage as customer_discount
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

// Start server
const PORT = process.env.PORT || 8080;

console.log('🚀 Starting production server with Invoice System...');
console.log('📡 Latcom API configured:', latcomAPI.isConfigured() ? 'YES' : 'NO');

testDatabase().then(() => {
    initDatabase().then(() => {
        app.listen(PORT, () => {
            console.log(`✅ Server running on port ${PORT}`);
            console.log(`📊 Mode: ${dbConnected ? 'PRODUCTION with billing' : 'TEST MODE without billing'}`);
            console.log('🎯 EnviaDespensa ready to test!');
        });
    });
});
