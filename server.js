const express = require('express');
const { createPool } = require('./database-config');
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

// Main topup endpoint with billing
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
        const newBalance = parseFloat(customer.current_balance) - parseFloat(amount);
        
        // Create transaction record
        await client.query(`
            INSERT INTO transactions 
            (transaction_id, customer_id, phone, amount, status, reference, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, NOW())
        `, [transactionId, customerId, phone, amount, 'PENDING', reference || '']);
        
        // TODO: Call Latcom API here
        const latcomSuccess = true; // Simulate success
        const operatorId = 'OP_' + Date.now();
        
        if (latcomSuccess) {
            // Update customer balance
            await client.query(
                'UPDATE customers SET current_balance = $1 WHERE customer_id = $2',
                [newBalance, customerId]
            );
            
            // Create billing record
            await client.query(`
                INSERT INTO billing_records 
                (customer_id, transaction_id, amount, type, balance_before, balance_after)
                VALUES ($1, $2, $3, $4, $5, $6)
            `, [
                customerId, 
                transactionId, 
                amount, 
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
            
            console.log(`✅ Transaction ${transactionId} successful. Balance: ${customer.current_balance} → ${newBalance}`);
            
            res.json({
                success: true,
                transaction: {
                    id: transactionId,
                    status: 'SUCCESS',
                    amount: parseFloat(amount),
                    phone: phone,
                    reference: reference || '',
                    operatorTransactionId: operatorId,
                    processedAt: new Date().toISOString(),
                    currency: 'MXN'
                },
                message: 'Top-up processed successfully',
                remaining_balance: newBalance
            });
        } else {
            await client.query('ROLLBACK');
            throw new Error('Latcom processing failed');
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

// Balance check endpoint
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
        const result = await pool.query(
            'SELECT * FROM customers WHERE api_key = $1 AND customer_id = $2',
            [apiKey, customerId]
        );
        
        if (result.rows.length === 0) {
            return res.status(401).json({ success: false, error: 'Invalid credentials' });
        }
        
        res.json({
            success: true,
            customer_id: customerId,
            company_name: result.rows[0].company_name,
            current_balance: parseFloat(result.rows[0].current_balance),
            credit_limit: parseFloat(result.rows[0].credit_limit),
            currency: 'MXN'
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

        res.json({ success: true, message: 'Credit added successfully' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Dashboard route
app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'dashboard.html'));
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

// Start server
const PORT = process.env.PORT || 8080;

console.log('🚀 Starting production server...');
testDatabase().then(() => {
    initDatabase().then(() => {
        app.listen(PORT, () => {
            console.log(`✅ Server running on port ${PORT}`);
            console.log(`📊 Mode: ${dbConnected ? 'PRODUCTION with billing' : 'TEST MODE without billing'}`);
            console.log('🎯 EnviaDespensa ready to test!');
        });
    });
});
