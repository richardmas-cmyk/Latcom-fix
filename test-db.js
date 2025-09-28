const DatabaseManager = require('./database');

async function test() {
    console.log('Testing database connection...');
    const db = new DatabaseManager();
    
    const health = await db.healthCheck();
    console.log('Database health:', health);
    
    if (health.status === 'healthy') {
        console.log('Initializing database...');
        await db.initializeDatabase();
        console.log('Database setup complete!');
        
        // Test customer lookup
        const customer = await db.getCustomerByApiKey('relier_client_2025');
        console.log('Test customer found:', customer ? customer.name : 'Not found');
    }
}

test().catch(console.error);
