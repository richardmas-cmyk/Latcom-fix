const { Pool } = require('pg');

// Database configuration for Railway
function createPool() {
    const DATABASE_URL = process.env.DATABASE_URL;
    const DATABASE_PRIVATE_URL = process.env.DATABASE_PRIVATE_URL;

    // Try private URL first (internal Railway network), then public URL
    const dbUrl = DATABASE_PRIVATE_URL || DATABASE_URL;

    if (!dbUrl) {
        console.log('⚠️ No DATABASE_URL found, running without database');
        return null;
    }

    console.log('🔌 Connecting to database...');

    // Railway-optimized configuration
    return new Pool({
        connectionString: dbUrl,
        ssl: false,  // Railway internal network doesn't need SSL
        max: 5,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
    });
}

module.exports = { createPool };
