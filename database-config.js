const { Pool } = require('pg');

// Database configuration for Railway (WORKING VERSION)
function createPool() {
    const DATABASE_URL = process.env.DATABASE_URL;

    if (!DATABASE_URL) {
        console.log('⚠️ No DATABASE_URL found, running without database');
        return null;
    }

    // Parse to see what host we're trying to connect to
    try {
        const url = new URL(DATABASE_URL);
        console.log('🔌 Connecting to Railway database...');
        console.log('📍 Host:', url.hostname);
        console.log('📍 Port:', url.port);
    } catch (e) {
        console.log('🔌 Connecting with connection string...');
    }

    // Use the EXACT working config from commit 68df923
    return new Pool({
        connectionString: DATABASE_URL,
        ssl: {
            rejectUnauthorized: false
        }
    });
}

module.exports = { createPool };
