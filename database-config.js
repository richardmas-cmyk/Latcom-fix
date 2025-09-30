const { Pool } = require('pg');

// Database configuration for Railway
function createPool() {
    // Use PUBLIC URL (with proxy) instead of internal URL (IPv6 only)
    const DATABASE_URL = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL;

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

    // Railway proxy.rlwy.net requires proper SSL configuration
    // Append sslmode if not present
    const urlWithSSL = DATABASE_URL.includes('?')
        ? `${DATABASE_URL}&sslmode=require`
        : `${DATABASE_URL}?sslmode=require`;

    return new Pool({
        connectionString: urlWithSSL,
        ssl: {
            rejectUnauthorized: false,
            // Enable SSL but don't verify certificate
            checkServerIdentity: () => undefined
        }
    });
}

module.exports = { createPool };
