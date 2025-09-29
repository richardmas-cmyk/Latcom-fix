const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

class DatabaseManager {
    constructor() {
        this.pool = pool;
    }

    async initializeDatabase() {
        const client = await this.pool.connect();
        try {
            const tables = await client.query(`
                SELECT table_name FROM information_schema.tables 
                WHERE table_schema = 'public' AND table_name IN ('customers', 'transactions', 'providers', 'admins')
            `);
            
            if (tables.rows.length < 4) {
                console.log('Creating tables...');
                await this.createTables(client);
                await this.seedInitialData(client);
            } else {
                console.log('Tables exist');
            }
        } finally {
            client.release();
        }
    }

    async createTables(client) {
        await client.query(`
            CREATE TABLE IF NOT EXISTS customers (
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

            CREATE TABLE IF NOT EXISTS transactions (
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
                failure_code VARCHAR(50),
                request_data JSONB,
                response_data JSONB,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                completed_at TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS providers (
                id SERIAL PRIMARY KEY,
                name VARCHAR(50) UNIQUE NOT NULL,
                credit_limit DECIMAL(10,2) NOT NULL,
                current_used DECIMAL(10,2) DEFAULT 0.00,
                alert_threshold DECIMAL(5,2) DEFAULT 0.80
            );

            CREATE TABLE IF NOT EXISTS admins (
                id SERIAL PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_transactions_customer_id ON transactions(customer_id);
            CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);
        `);
    }

    async seedInitialData(client) {
        await client.query(`
            INSERT INTO customers (customer_id, name, email, api_key, balance, daily_limit) VALUES
            ('customer_001', 'Customer A', 'customer@example.com', 'api_key_12345', 1000.00, 5000.00),
            ('client_001', 'Cliente Relier', 'client@relier.group', 'relier_client_2025', 5000.00, 10000.00)
            ON CONFLICT DO NOTHING
        `);

        await client.query(`
            INSERT INTO providers (name, credit_limit) VALUES
            ('latcom', ${process.env.PROVIDER_CREDIT_LIMIT || 10000})
            ON CONFLICT DO NOTHING
        `);

        const hash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 10);
        await client.query(`
            INSERT INTO admins (username, password_hash) VALUES
            ('${process.env.ADMIN_USERNAME}', '${hash}')
            ON CONFLICT DO NOTHING
        `);
    }

    async getCustomerByApiKey(apiKey) {
        const res = await this.pool.query('SELECT * FROM customers WHERE api_key = $1 AND active = true', [apiKey]);
        return res.rows[0];
    }

    async getDailyUsed(customerId, date) {
        const res = await this.pool.query(`
            SELECT SUM(customer_amount) as used FROM transactions 
            WHERE customer_id = $1 AND created_at::date = $2 AND status = 'Success'
        `, [customerId, date]);
        return res.rows[0].used || 0;
    }

    async updateCustomerBalance(customerId, amount) {
        await this.pool.query('UPDATE customers SET balance = balance - $1 WHERE customer_id = $2', [amount, customerId]);
    }

    async insertTransaction(data) {
        const res = await this.pool.query(`
            INSERT INTO transactions (transaction_id, provider_transaction_id, customer_id, destination_number, customer_amount, wholesale_cost, status, provider_status, failure_code, request_data, response_data, completed_at) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP) RETURNING id, profit
        `, [data.transaction_id, data.provider_transaction_id, data.customer_id, data.destination_number, data.customer_amount, data.wholesale_cost, data.status, data.provider_status, data.failure_code || null, JSON.stringify(data.request_data), JSON.stringify(data.response_data)]);
        return res.rows[0];
    }

    async getProviderByName(name) {
        const res = await this.pool.query('SELECT * FROM providers WHERE name = $1', [name]);
        return res.rows[0];
    }

    async updateProviderUsed(name, addUsed) {
        await this.pool.query('UPDATE providers SET current_used = current_used + $1 WHERE name = $2', [addUsed, name]);
    }

    async getDailyReport(date) {
        const res = await this.pool.query('SELECT * FROM transactions WHERE created_at::date = $1 AND status = \'Success\'', [date]);
        return res.rows;
    }

    async getFullLog(date) {
        const res = await this.pool.query('SELECT * FROM transactions WHERE created_at::date = $1 ORDER BY created_at DESC', [date]);
        return res.rows;
    }

    async getTransactionsLive() {
        const res = await this.pool.query('SELECT * FROM transactions ORDER BY created_at DESC LIMIT 50');
        return res.rows;
    }

    async getCustomers() {
        const res = await this.pool.query('SELECT * FROM customers');
        return res.rows;
    }

    async getProviders() {
        const res = await this.pool.query('SELECT * FROM providers');
        return res.rows;
    }

    async getAdminByUsername(username) {
        const res = await this.pool.query('SELECT * FROM admins WHERE username = $1', [username]);
        return res.rows[0];
    }

    async healthCheck() {
        const res = await this.pool.query('SELECT NOW()');
        return { status: 'healthy', time: res.rows[0].now };
    }
}

module.exports = DatabaseManager;
