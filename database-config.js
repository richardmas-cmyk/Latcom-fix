const { Pool } = require('pg');

// Database configuration for Railway (WORKING VERSION)
function createPool() {
    const DATABASE_URL = process.env.DATABASE_URL;

    if (!DATABASE_URL) {
        console.log('⚠️ No DATABASE_URL found, running without database');
        return null;
    }

    console.log('🔌 Connecting to Railway database...');
    console.log('📍 URL preview:', DATABASE_URL.substring(0, 30) + '...');

    // Use the EXACT working config from commit 68df923
    return new Pool({
        connectionString: DATABASE_URL,
        ssl: {
            rejectUnauthorized: false
        }
    });
}

module.exports = { createPool };
