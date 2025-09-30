const { Pool } = require('pg');

// Database configuration for Railway
function createPool() {
    const DATABASE_URL = process.env.DATABASE_URL;

    if (!DATABASE_URL) {
        console.log('⚠️ No DATABASE_URL found, running without database');
        return null;
    }

    console.log('🔌 Connecting to Railway database...');

    // Parse the URL to handle it properly
    const url = new URL(DATABASE_URL);

    // Railway uses postgres://user:pass@host:port/db format
    // Extract components and connect without SSL for internal network
    return new Pool({
        host: url.hostname,
        port: parseInt(url.port) || 5432,
        user: url.username,
        password: url.password,
        database: url.pathname.slice(1), // Remove leading /
        ssl: false,
        max: 5,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
    });
}

module.exports = { createPool };
