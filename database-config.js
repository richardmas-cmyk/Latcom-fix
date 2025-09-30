const { Pool } = require('pg');
const dns = require('dns');

// Force IPv4 DNS resolution
dns.setDefaultResultOrder('ipv4first');

// Database configuration for Railway
function createPool() {
    const DATABASE_URL = process.env.DATABASE_URL;

    if (!DATABASE_URL) {
        console.log('⚠️ No DATABASE_URL found, running without database');
        return null;
    }

    console.log('🔌 Connecting to Railway database (IPv4 forced)...');

    // Parse the URL to handle it properly
    const url = new URL(DATABASE_URL);

    console.log(`📍 Connecting to: ${url.hostname}:${url.port || 5432}`);

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
