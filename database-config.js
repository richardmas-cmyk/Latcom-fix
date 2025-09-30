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

    // Try with sslmode=disable for Railway proxy
    const urlNoSSL = DATABASE_URL.includes('?')
        ? `${DATABASE_URL}&sslmode=disable`
        : `${DATABASE_URL}?sslmode=disable`;

    console.log('🔧 Attempting connection with SSL disabled...');

    return new Pool({
        connectionString: urlNoSSL
    });
}

module.exports = { createPool };
