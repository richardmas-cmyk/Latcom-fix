const { Pool } = require('pg');

// Database configuration for Railway
function createPool() {
    const DATABASE_URL = process.env.DATABASE_URL;
    
    if (!DATABASE_URL) {
        console.log('⚠️ No DATABASE_URL found, running without database');
        return null;
    }
    
    // Parse the DATABASE_URL
    const isRailwayProxy = DATABASE_URL.includes('proxy.rlwy.net');
    
    if (isRailwayProxy) {
        console.log('🚂 Using Railway Proxy configuration');
        // Railway proxy needs specific config
        return new Pool({
            connectionString: DATABASE_URL,
            ssl: false,  // Railway proxy handles SSL
            max: 5,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 10000,
        });
    } else {
        console.log('🔒 Using standard SSL configuration');
        // Standard PostgreSQL with SSL
        return new Pool({
            connectionString: DATABASE_URL,
            ssl: {
                rejectUnauthorized: false
            }
        });
    }
}

module.exports = { createPool };
