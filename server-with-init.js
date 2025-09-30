const express = require('express');
const { Pool } = require('pg');

const app = express();
app.use(express.json());

// Railway internal PostgreSQL
const pool = new Pool({
    connectionString: 'postgresql://postgres:BSvPcmMMbGxsbGDSHfbryzUkKDnAwkzH@postgres-iuh3.railway.internal:5432/railway'
});

// Initialize database
async function initDatabase() {
    try {
        console.log('🚀 Initializing database...');
        
        await pool.query(`
            CREATE TABLE IF NOT EXISTS customers (
                id SERIAL PRIMARY KEY,
                customer_id VARCHAR(50) UNIQUE NOT NULL,
                company_name VARCHAR(255) NOT NULL,
                api_key VARCHAR(255) UNIQUE NOT NULL,
                secret_key VARCHAR(255),
                credit_limit DECIMAL(10,2) DEFAULT 0,
                current_balance DECIMAL(10,2) DEFAULT 0,
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
                status VARCHAR(20),
                reference VARCHAR(100),
                created_at TIMESTAMP DEFAULT NOW()
            )
        `);
        
        const exists = await pool.query('SELECT * FROM customers WHERE customer_id = $1', ['ENVIADESPENSA_001']);
        if (exists.rows.length === 0) {
            await pool.query(
                'INSERT INTO customers (customer_id, company_name, api_key, secret_key, credit_limit, current_balance) VALUES ($1, $2, $3, $4, $5, $6)',
                ['ENVIADESPENSA_001', 'EnviaDespensa', 'enviadespensa_prod_2025', 'ENV!desp3ns4#2025', 10000, 10000]
            );
            console.log('✅ EnviaDespensa customer created!');
        }
        console.log('✅ Database initialized!');
    } catch (error) {
        console.error('DB Init Error:', error.message);
    }
}

// Test endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'OK', message: 'Server with database is running!' });
});

// EnviaDespensa endpoint
app.post('/api/enviadespensa/topup', async (req, res) => {
    console.log('Received topup request:', req.body);
    const apiKey = req.headers['x-api-key'];
    const customerId = req.headers['x-customer-id'];
    const { phone, amount, reference } = req.body;
    
    try {
        const customer = await pool.query(
            'SELECT * FROM customers WHERE api_key = $1 AND customer_id = $2',
            [apiKey, customerId]
        );
        
        if (customer.rows.length === 0) {
            return res.status(401).json({ success: false, error: 'Invalid credentials' });
        }
        
        const transactionId = 'RLR' + Date.now();
        res.json({
            success: true,
            transaction: {
                id: transactionId,
                status: 'SUCCESS',
                amount: amount,
                phone: phone
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

const PORT = process.env.PORT || 8080;
initDatabase().then(() => {
    app.listen(PORT, () => {
        console.log(`✅ Server running on port ${PORT} with DATABASE!`);
    });
});
