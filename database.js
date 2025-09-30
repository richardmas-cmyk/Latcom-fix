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
        const client = await this.pool.connect();
        try {
            const tables = await client.query(`
                SELECT table_name FROM information_schema.tables 
                WHERE table_schema = 'public' AND table_name IN ('customers', 'transactions', 'providers', 'admins')
            `);

            if (tables.rows.length === 0) {
                await client.query(`
                    CREATE TABLE IF NOT EXISTS customers (
                        id SERIAL PRIMARY KEY,
                        name VARCHAR(255) UNIQUE,
                        balance DECIMAL DEFAULT 0,
                        daily_limit DECIMAL DEFAULT 1000,
                        created_at TIMESTAMP DEFAULT NOW()
                    );
                    CREATE TABLE IF NOT EXISTS providers (
                        id SERIAL PRIMARY KEY,
                        name VARCHAR(255) UNIQUE,
                        current_used DECIMAL DEFAULT 0,
                        credit_limit DECIMAL DEFAULT 10000,
                        created_at TIMESTAMP DEFAULT NOW()
                    );
                    CREATE TABLE IF NOT EXISTS transactions (
                        id SERIAL PRIMARY KEY,
                        transaction_id VARCHAR(255) UNIQUE,
                        customer_id INTEGER REFERENCES customers(id),
                        provider_id INTEGER REFERENCES providers(id),
                        status VARCHAR(50),
                        customer_amount DECIMAL,
                        wholesale_cost DECIMAL,
                        profit DECIMAL,
                        failure_code VARCHAR(50),
                        created_at TIMESTAMP DEFAULT NOW()
                    );
                    CREATE TABLE IF NOT EXISTS admins (
                        id SERIAL PRIMARY KEY,
                        username VARCHAR(255) UNIQUE,
                        password_hash VARCHAR(255)
                    );
                `);

                const hash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 10);
                await client.query('INSERT INTO admins (username, password_hash) VALUES ($1, $2)', [process.env.ADMIN_USERNAME, hash]);
            }
        } finally {
            client.release();
        }
    }

    async query(text, params) {
        return this.pool.query(text, params);
    }

    async getAdminByUsername(username) {
        const result = await this.pool.query(
            'SELECT * FROM admins WHERE username = $1',
            [username]
        );
        return result.rows[0];
    }

    async getTransactionsLive() {
        const result = await this.pool.query(
            'SELECT * FROM transactions ORDER BY created_at DESC LIMIT 50'
        );
        return result.rows;
    }

    async getCustomers() {
        const result = await this.pool.query(
            'SELECT * FROM customers ORDER BY name'
        );
        return result.rows;
    }

    async getProviders() {
        const result = await this.pool.query(
            'SELECT * FROM providers ORDER BY name'
        );
        return result.rows;
    }

    async getDailyReport(date) {
        const result = await this.pool.query(
            'SELECT * FROM transactions WHERE DATE(created_at) = $1 AND status = $2',
            [date, 'success']
        );
        return result.rows;
    }

    async getFullLog(date) {
        const result = await this.pool.query(
            'SELECT * FROM transactions WHERE DATE(created_at) = $1',
            [date]
        );
        return result.rows;
    }
}

module.exports = DatabaseManager;
