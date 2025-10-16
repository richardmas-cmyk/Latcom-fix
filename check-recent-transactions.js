#!/usr/bin/env node
/**
 * Check recent transactions from last 24 hours
 */

const { Pool } = require('pg');

async function checkRecentTransactions() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('railway')
            ? { rejectUnauthorized: false }
            : false
    });

    try {
        console.log('🔍 Checking transactions from last 24 hours...\n');

        // Get transactions from last 24 hours
        const result = await pool.query(`
            SELECT
                id,
                customer_id,
                amount,
                phone,
                status,
                provider,
                provider_response,
                created_at,
                updated_at
            FROM transactions
            WHERE created_at >= NOW() - INTERVAL '24 hours'
            ORDER BY created_at DESC
            LIMIT 50
        `);

        if (result.rows.length === 0) {
            console.log('No transactions found in last 24 hours');
            return;
        }

        console.log(`Found ${result.rows.length} transactions:\n`);
        console.log('='.repeat(120));

        result.rows.forEach((tx, index) => {
            console.log(`\n${index + 1}. Transaction ID: ${tx.id}`);
            console.log(`   Customer: ${tx.customer_id}`);
            console.log(`   Phone: ${tx.phone}`);
            console.log(`   Amount: $${tx.amount}`);
            console.log(`   Status: ${tx.status}`);
            console.log(`   Provider: ${tx.provider || 'N/A'}`);
            console.log(`   Created: ${tx.created_at}`);

            if (tx.provider_response) {
                try {
                    const response = typeof tx.provider_response === 'string'
                        ? JSON.parse(tx.provider_response)
                        : tx.provider_response;
                    console.log(`   Provider Response: ${JSON.stringify(response, null, 2).substring(0, 200)}...`);
                } catch (e) {
                    console.log(`   Provider Response: ${tx.provider_response.substring(0, 100)}...`);
                }
            }
            console.log('   ' + '-'.repeat(118));
        });

        // Summary by provider
        const summary = await pool.query(`
            SELECT
                provider,
                status,
                COUNT(*) as count,
                SUM(amount) as total_amount
            FROM transactions
            WHERE created_at >= NOW() - INTERVAL '24 hours'
            GROUP BY provider, status
            ORDER BY provider, status
        `);

        console.log('\n\n📊 SUMMARY BY PROVIDER (Last 24 hours):');
        console.log('='.repeat(120));
        summary.rows.forEach(row => {
            console.log(`${row.provider || 'Unknown'} - ${row.status}: ${row.count} transactions ($${row.total_amount || 0})`);
        });

    } catch (error) {
        console.error('Error checking transactions:', error.message);
        if (error.code === 'ECONNREFUSED') {
            console.error('\n❌ Cannot connect to database. Make sure DATABASE_URL is set.');
        }
    } finally {
        await pool.end();
    }
}

checkRecentTransactions().catch(console.error);
