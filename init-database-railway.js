const { Pool } = require('pg');

// Use Railway internal URL - this ONLY works when deployed to Railway
const pool = new Pool({
    connectionString: 'postgresql://postgres:BSvPcmMMbGxsbGDSHfbryzUkKDnAwkzH@postgres-iuh3.railway.internal:5432/railway'
});

async function initDatabase() {
    try {
        console.log('🚀 Connecting to Railway PostgreSQL (internal network)...');
        const test = await pool.query('SELECT NOW()');
        console.log('✅ Database connected! Time:', test.rows[0].now);
        
        // Create customers table
        console.log('📋 Creating customers table...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS customers (
                id SERIAL PRIMARY KEY,
                customer_id VARCHAR(50) UNIQUE NOT NULL,
                company_name VARCHAR(255) NOT NULL,
                api_key VARCHAR(255) UNIQUE NOT NULL,
                secret_key VARCHAR(255) NOT NULL,
                credit_limit DECIMAL(10,2) DEFAULT 0,
                current_balance DECIMAL(10,2) DEFAULT 0,
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT NOW()
            )
        `);
        console.log('✅ Customers table ready');
        
        // Create transactions table
        console.log('📋 Creating transactions table...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS transactions (
                id SERIAL PRIMARY KEY,
                transaction_id VARCHAR(50) UNIQUE NOT NULL,
                customer_id VARCHAR(50),
                phone VARCHAR(20),
                amount DECIMAL(10,2),
                status VARCHAR(20),
                reference VARCHAR(100),
                operator_transaction_id VARCHAR(100),
                created_at TIMESTAMP DEFAULT NOW()
            )
        `);
        console.log('✅ Transactions table ready');
        
        // Check if EnviaDespensa exists
        console.log('🔍 Checking for EnviaDespensa customer...');
        const exists = await pool.query(
            'SELECT * FROM customers WHERE customer_id = $1',
            ['ENVIADESPENSA_001']
        );
        
        if (exists.rows.length === 0) {
            console.log('📝 Creating EnviaDespensa customer...');
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
            console.log('✅ EnviaDespensa customer created with $10,000 credit!');
        } else {
            console.log('✅ EnviaDespensa already exists. Balance: $' + exists.rows[0].current_balance);
        }
        
        console.log('\n🎉 DATABASE INITIALIZATION COMPLETE!');
        console.log('📝 EnviaDespensa can now use:');
        console.log('   API Key: enviadespensa_prod_2025');
        console.log('   Customer ID: ENVIADESPENSA_001');
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

// Run it
initDatabase();
