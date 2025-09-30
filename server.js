const express = require('express');
const { Pool } = require('pg');

const app = express();
app.use(express.json());

// Your Railway DATABASE_URL
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:BSvPcmMMbGxsbGDSHfbryzUkKDnAwkzH@trolley.proxy.rlwy.net:38618/railway';

console.log('🔌 Using DATABASE_URL:', DATABASE_URL.substring(0, 30) + '...');

// Railway's proxy requires this SSL config
const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// Test and initialize database
async function initDatabase() {
    try {
        console.log('🚀 Connecting to PostgreSQL...');
        const test = await pool.query('SELECT NOW()');
        console.log('✅ Database connected! Time:', test.rows[0].now);
        
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
        console.log('✅ Customers table ready');
        
        await pool.query(`
            CREATE TABLE IF NOT EXISTS transactions (
                id SERIAL PRIMARY KEY,
                transaction_id VARCHAR(50) UNIQUE NOT NULL,
                customer_id VARCHAR(50),
                phone VARCHAR(20),
                amount DECIMAL(10,2),
                status VARCHAR(20),
                reference VARCHAR(100),
                created_at TIMESTAMP DEFAULT NOW()
            )
        `);
        console.log('✅ Transactions table ready');
        
        // Add EnviaDespensa
        const check = await pool.query('SELECT * FROM customers WHERE customer_id = $1', ['ENVIADESPENSA_001']);
        if (check.rows.length === 0) {
            await pool.query(
                `INSERT INTO customers (customer_id, company_name, api_key, secret_key, credit_limit, current_balance) 
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                ['ENVIADESPENSA_001', 'EnviaDespensa', 'enviadespensa_prod_2025', 'ENV!desp3ns4#2025', 10000, 10000]
            );
            console.log('✅ EnviaDespensa customer created with $10,000 credit!');
        } else {
            console.log('✅ EnviaDespensa exists with balance: $' + check.rows[0].current_balance);
        }
        
        return true;
    } catch (error) {
        console.error('❌ Database initialization error:', error.message);
        return false;
    }
}

// Health endpoint
app.get('/health', async (req, res) => {
    try {
        await pool.query('SELECT 1');
        res.json({ 
            status: 'OK', 
            message: 'Server with database is running!',
            database: 'connected' 
        });
    } catch (err) {
        res.json({ 
            status: 'OK', 
            message: 'Server running',
            database: 'error: ' + err.message 
        });
    }
});

// EnviaDespensa topup endpoint
app.post('/api/enviadespensa/topup', async (req, res) => {
    console.log('📱 Topup request from:', req.headers['x-customer-id']);
    
    const apiKey = req.headers['x-api-key'];
    const customerId = req.headers['x-customer-id'];
    const { phone, amount, reference } = req.body;
    
    // Validate input
    if (!apiKey || !customerId) {
        return res.status(401).json({ 
            success: false, 
            error: 'Missing API credentials' 
        });
    }
    
    try {
        // Check customer
        const customer = await pool.query(
            'SELECT * FROM customers WHERE api_key = $1 AND customer_id = $2',
            [apiKey, customerId]
        );
        
        if (customer.rows.length === 0) {
            return res.status(401).json({ 
                success: false, 
                error: 'Invalid API credentials' 
            });
        }
        
        const cust = customer.rows[0];
        
        // Check balance
        if (parseFloat(cust.current_balance) < parseFloat(amount)) {
            return res.status(403).json({ 
                success: false, 
                error: 'Insufficient balance',
                current_balance: parseFloat(cust.current_balance),
                requested: parseFloat(amount)
            });
        }
        
        // Process transaction
        const transactionId = 'RLR' + Date.now();
        
        // Deduct balance
        await pool.query(
            'UPDATE customers SET current_balance = current_balance - $1 WHERE customer_id = $2',
            [amount, customerId]
        );
        
        // Record transaction
        await pool.query(
            'INSERT INTO transactions (transaction_id, customer_id, phone, amount, status, reference) VALUES ($1, $2, $3, $4, $5, $6)',
            [transactionId, customerId, phone, amount, 'SUCCESS', reference || '']
        );
        
        // Get new balance
        const newBalance = await pool.query('SELECT current_balance FROM customers WHERE customer_id = $1', [customerId]);
        
        console.log(`✅ Transaction ${transactionId} successful. New balance: $${newBalance.rows[0].current_balance}`);
        
        res.json({
            success: true,
            transaction: {
                id: transactionId,
                status: 'SUCCESS',
                amount: parseFloat(amount),
                phone: phone,
                reference: reference || '',
                processedAt: new Date().toISOString(),
                currency: 'MXN'
            },
            message: 'Top-up processed successfully',
            remaining_balance: parseFloat(newBalance.rows[0].current_balance)
        });
        
    } catch (error) {
        console.error('❌ Transaction error:', error.message);
        res.status(500).json({ 
            success: false, 
            error: 'Transaction failed: ' + error.message 
        });
    }
});

// Balance check endpoint
app.get('/api/balance', async (req, res) => {
    const apiKey = req.headers['x-api-key'];
    const customerId = req.headers['x-customer-id'];
    
    try {
        const customer = await pool.query(
            'SELECT * FROM customers WHERE api_key = $1 AND customer_id = $2',
            [apiKey, customerId]
        );
        
        if (customer.rows.length === 0) {
            return res.status(401).json({ success: false, error: 'Invalid credentials' });
        }
        
        res.json({
            success: true,
            customer_id: customerId,
            company: customer.rows[0].company_name,
            balance: parseFloat(customer.rows[0].current_balance),
            credit_limit: parseFloat(customer.rows[0].credit_limit),
            currency: 'MXN'
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Start server
const PORT = process.env.PORT || 8080;

console.log('🚀 Starting server...');
initDatabase().then((dbReady) => {
    app.listen(PORT, () => {
        console.log(`✅ Server running on port ${PORT}`);
        console.log(`📊 Database: ${dbReady ? 'CONNECTED' : 'NOT CONNECTED'}`);
        console.log('📍 Ready for EnviaDespensa!');
    });
});
