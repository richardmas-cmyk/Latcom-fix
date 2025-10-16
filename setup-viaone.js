/**
 * Via.One Retail System Setup Script
 * Creates stores, owner account, and default pricing
 */

const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const fs = require('fs');

// Database connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false }
});

// Default passwords (CHANGE THESE IN PRODUCTION!)
const STORE_PASSWORDS = {
    'STORE_001': 'store1pass',
    'STORE_002': 'store2pass',
    'STORE_003': 'store3pass',
    'STORE_004': 'store4pass'
};

const OWNER_PASSWORD = 'ownerpass123';

async function setupViaOne() {
    console.log('🚀 Setting up Via.One Retail System...\n');

    try {
        // 1. Run SQL schema
        console.log('📋 Creating database tables...');
        const sqlSchema = fs.readFileSync('./viaone-setup.sql', 'utf8');

        // Split by semicolons and execute each statement
        const statements = sqlSchema
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0 && !s.startsWith('--'));

        for (const statement of statements) {
            if (statement.includes('CREATE TABLE') || statement.includes('CREATE INDEX')) {
                await pool.query(statement);
            }
        }
        console.log('✅ Tables created\n');

        // 2. Create owner account
        console.log('👤 Creating owner account...');
        await pool.query(`
            INSERT INTO owner_settings (owner_id, owner_name, email, is_active)
            VALUES ('OWNER_001', 'Store Owner', 'owner@viaone.mx', true)
            ON CONFLICT (owner_id) DO NOTHING
        `);
        console.log('✅ Owner account created\n');

        // 3. Create stores with hashed passwords
        console.log('🏪 Creating stores...');
        const stores = [
            { id: 'STORE_001', name: 'Via.One Store 1', username: 'store1' },
            { id: 'STORE_002', name: 'Via.One Store 2', username: 'store2' },
            { id: 'STORE_003', name: 'Via.One Store 3', username: 'store3' },
            { id: 'STORE_004', name: 'Via.One Store 4', username: 'store4' }
        ];

        for (const store of stores) {
            const password = STORE_PASSWORDS[store.id];
            const passwordHash = await bcrypt.hash(password, 10);

            await pool.query(`
                INSERT INTO stores (store_id, store_name, username, password_hash, owner_id, is_active)
                VALUES ($1, $2, $3, $4, 'OWNER_001', true)
                ON CONFLICT (store_id)
                DO UPDATE SET password_hash = $4, store_name = $2
            `, [store.id, store.name, store.username, passwordHash]);

            console.log(`   ✅ ${store.name} - Username: ${store.username} | Password: ${password}`);
        }
        console.log('\n');

        // 4. Create default pricing
        console.log('💰 Setting up default pricing...');
        const products = [
            { type: 'mobile_topup', name: 'Mobile Topup', cost: 0, fee: 5 },
            { type: 'spei', name: 'SPEI Bank Transfer', cost: 0, fee: 10 },
            { type: 'oxxo_gift_card', name: 'OXXO Gift Card', cost: 0, fee: 5 }
        ];

        for (const store of stores) {
            for (const product of products) {
                await pool.query(`
                    INSERT INTO store_pricing (store_id, product_type, product_name, cost_per_transaction, retail_fee, is_active)
                    VALUES ($1, $2, $3, $4, $5, true)
                    ON CONFLICT DO NOTHING
                `, [store.id, product.type, product.name, product.cost, product.fee]);
            }
        }
        console.log('✅ Default pricing configured\n');

        // 5. Summary
        console.log('🎉 Via.One Retail System Setup Complete!\n');
        console.log('═══════════════════════════════════════════════════════');
        console.log('📊 STORE LOGINS:');
        console.log('───────────────────────────────────────────────────────');
        stores.forEach(store => {
            console.log(`   ${store.name}:`);
            console.log(`      URL: /store/${store.username}`);
            console.log(`      Username: ${store.username}`);
            console.log(`      Password: ${STORE_PASSWORDS[store.id]}`);
            console.log('');
        });
        console.log('───────────────────────────────────────────────────────');
        console.log('👤 OWNER LOGIN:');
        console.log('───────────────────────────────────────────────────────');
        console.log(`   URL: /owner`);
        console.log(`   Username: owner`);
        console.log(`   Password: ${OWNER_PASSWORD}`);
        console.log('═══════════════════════════════════════════════════════\n');
        console.log('⚠️  IMPORTANT: Change these passwords in production!\n');

        await pool.end();
        process.exit(0);

    } catch (error) {
        console.error('❌ Setup failed:', error.message);
        console.error(error);
        await pool.end();
        process.exit(1);
    }
}

// Run setup
setupViaOne();
