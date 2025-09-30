const { Pool } = require('pg');

// Database configuration for Railway
function createPool() {
    // Check if we have individual PostgreSQL environment variables
    const PGHOST = process.env.PGHOST;
    const PGPORT = process.env.PGPORT;
    const PGUSER = process.env.PGUSER;
    const PGPASSWORD = process.env.PGPASSWORD;
    const PGDATABASE = process.env.PGDATABASE;

    if (!PGHOST || !PGUSER || !PGPASSWORD || !PGDATABASE) {
        console.log('⚠️ No database credentials found, running without database');
        return null;
    }

    console.log('🔌 Connecting to database via individual credentials...');
    console.log(`📍 Host: ${PGHOST}:${PGPORT}`);

    // Use individual parameters instead of connection string
    // Force IPv4 for Railway compatibility
    return new Pool({
        host: PGHOST,
        port: PGPORT || 5432,
        user: PGUSER,
        password: PGPASSWORD,
        database: PGDATABASE,
        ssl: false,
        max: 5,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
        // Force IPv4 to avoid IPv6 connection issues
        options: '-c client_encoding=UTF8',
        // Use IPv4 family explicitly
        family: 4
    });
}

module.exports = { createPool };
