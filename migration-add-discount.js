require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: false
});

const migration = `
-- Add discount_rate column to customers table
ALTER TABLE customers ADD COLUMN IF NOT EXISTS discount_rate DECIMAL(3,2) DEFAULT 0.10;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS api_key VARCHAR(255) UNIQUE;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;

-- Update existing customers to have default 10% discount
UPDATE customers SET discount_rate = 0.10 WHERE discount_rate IS NULL;

-- Add index for API key lookups
CREATE INDEX IF NOT EXISTS idx_customers_api_key ON customers(api_key);
`;

pool.query(migration, (err, res) => {
    if (err) {
        console.log('❌ Migration error:', err.message);
    } else {
        console.log('✅ Migration completed: Added discount_rate, api_key, active columns to customers');
    }
    pool.end();
});
