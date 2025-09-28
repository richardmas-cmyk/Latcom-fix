const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

class DatabaseManager {
    constructor() {
        this.pool = pool;
    }

    async initializeDatabase() {
        const client = await this.pool.connect();
        try {
            const result = await client.query(`
                SELECT table_name FROM information_schema.tables 
                WHERE table_schema = 'public' AND table_name = 'customers'
            `);
            
            if (result.rows.length === 0) {
                console.log('Creating database tables...');
                await this.createTables(client);
                await this.seedInitialData(client);
                console.log('Database initialized successfully');
            } else {
                console.log('Database tables already exist');
            }
        } finally {
            client.release();
        }
    }

    async createTables(client) {
        const createTablesSQL = `
            CREATE TABLE customers (
                id SERIAL PRIMARY KEY,
                customer_id VARCHAR(50) UNIQUE NOT NULL,
                name VARCHAR(255) NOT NULL,
                email VARCHAR(255),
                api_key VARCHAR(100) UNIQUE NOT NULL,
                active BOOLEAN DEFAULT true,
                balance DECIMAL(10,2) DEFAULT 0.00,
                markup_percentage DECIMAL(5,4) DEFAULT 0.0000,
                daily_limit DECIMAL(10,2) DEFAULT 1000.00,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE transactions (
                id SERIAL PRIMARY KEY,
                transaction_id VARCHAR(100) UNIQUE NOT NULL,
                provider_transaction_id VARCHAR(100),
                customer_id VARCHAR(50) NOT NULL,
                destination_number VARCHAR(20) NOT NULL,
                customer_amount DECIMAL(8,2) NOT NULL,
                wholesale_cost DECIMAL(8,2) NOT NULL,
                profit DECIMAL(8,2) GENERATED ALWAYS AS (customer_amount - wholesale_cost) STORED,
                status VARCHAR(20) NOT NULL,
                provider_status VARCHAR(50),
                request_data JSONB,
                response_data JSONB,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                completed_at TIMESTAMP
            );

            CREATE INDEX idx_transactions_customer_id ON transactions(customer_id);
            CREATE INDEX idx_transactions_created_at ON transactions(created_at);
        `;
        
        await client.query(createTablesSQL);
    }

    async seedInitialData(client) {
        await client.query(`
            INSERT INTO customers (customer_id, name, email, api_key, balance, daily_limit) VALUES
            ('customer_001', 'Customer A', 'customer@example.com', 'api_key_12345', 1000.00, 5000.00),
            ('client_001', 'Cliente Relier', 'client@relier.group', 'relier_client_2025', 5000.00, 10000.00)
            ON CONFLICT (customer_id) DO NOTHING
        `);
    }

    async getCustomerByApiKey(apiKey) {
        const result = await this.pool.query(
            'SELECT * FROM customers WHERE api_key = $1 AND active = true',
            [apiKey]
        );
        return result.rows[0];
    }

    async insertTransaction(transactionData) {
        const result = await this.pool.query(`
            INSERT INTO transactions (
                transaction_id, provider_transaction_id, customer_id,
                destination_number, customer_amount, wholesale_cost, status,
                provider_status, request_data, response_data, completed_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP)
            RETURNING id, profit
        `, [
            transactionData.transaction_id,
            transactionData.provider_transaction_id,
            transactionData.customer_id,
            transactionData.destination_number,
            transactionData.customer_amount,
            transactionData.wholesale_cost,
            transactionData.status,
            transactionData.provider_status,
            JSON.stringify(transactionData.request_data),
            JSON.stringify(transactionData.response_data)
        ]);
        return result.rows[0];
    }

    async healthCheck() {
        try {
            const result = await this.pool.query('SELECT NOW()');
            return { status: 'healthy', database: 'connected', timestamp: result.rows[0].now };
        } catch (error) {
            return { status: 'unhealthy', database: 'disconnected', error: error.message };
        }
    }
}

module.exports = DatabaseManager;
