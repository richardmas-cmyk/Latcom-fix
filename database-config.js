const { Pool } = require('pg');

// Database configuration for Railway
function createPool() {
    // Try DATABASE_PUBLIC_URL first (IPv4), fallback to individual vars
    const DATABASE_PUBLIC_URL = process.env.DATABASE_PUBLIC_URL;

    if (DATABASE_PUBLIC_URL) {
        console.log('🔌 Connecting via public URL...');

        // Try without SSL first for Railway
        return new Pool({
            connectionString: DATABASE_PUBLIC_URL,
            ssl: false,
            max: 5,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 10000,
        });
    }

    // Fallback to individual credentials
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
    });
}

module.exports = { createPool };
