const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: false
});

class DatabaseManager {
    constructor() {
        this.pool = pool;
    }

    async initializeDatabase() {
        try {
            await this.pool.query(`
                CREATE TABLE IF NOT EXISTS customers (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(255),
                    api_key VARCHAR(255) UNIQUE,
                    discount_rate DECIMAL(3,2),
                    balance DECIMAL(10,2),
                    daily_limit DECIMAL(10,2),
                    active BOOLEAN DEFAULT true,
                    created_at TIMESTAMP DEFAULT NOW()
                )
            `);
            
            await this.pool.query(`
                CREATE TABLE IF NOT EXISTS transactions (
                    id SERIAL PRIMARY KEY,
                    transaction_id VARCHAR(255) UNIQUE,
                    customer_id INTEGER REFERENCES customers(id),
                    status VARCHAR(50),
                    product_type VARCHAR(50),
                    customer_amount DECIMAL(10,2),
                    customer_discount DECIMAL(10,2),
                    forex_spread DECIMAL(10,2),
                    amount_to_provider DECIMAL(10,2),
                    provider_discount DECIMAL(10,2),
                    wholesale_cost DECIMAL(10,2),
                    margin_retained DECIMAL(10,2),
                    profit DECIMAL(10,2),
                    failure_code VARCHAR(100),
                    created_at TIMESTAMP DEFAULT NOW()
                )
            `);
            
            console.log('Database tables created successfully');
        } catch (error) {
            console.error('Database initialization failed:', error.message);
            // Don't crash - just log the error
        }
    }

    async query(text, params) {
        return this.pool.query(text, params);
    }
}

module.exports = new DatabaseManager();
