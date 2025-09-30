const express = require('express');
const app = express();
app.use(express.json());

// Simple working version WITHOUT database for now
console.log('🚀 Starting TEST server for EnviaDespensa...');

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'API ready for testing',
        mode: 'TEST_MODE_NO_DB' 
    });
});

// EnviaDespensa endpoint - TEST MODE
app.post('/api/enviadespensa/topup', (req, res) => {
    console.log('📱 Received request:', req.body);
    
    const apiKey = req.headers['x-api-key'];
    const customerId = req.headers['x-customer-id'];
    const { phone, amount, reference } = req.body;
    
    // Validate credentials
    if (apiKey !== 'enviadespensa_prod_2025' || customerId !== 'ENVIADESPENSA_001') {
        return res.status(401).json({ 
            success: false, 
            error: 'Invalid API credentials' 
        });
    }
    
    // Validate amount
    const validAmounts = [10, 20, 30, 50, 100, 200, 300, 500];
    if (!validAmounts.includes(parseInt(amount))) {
        return res.status(422).json({
            success: false,
            error: {
                code: 'INVALID_AMOUNT',
                message: 'Invalid amount',
                valid_amounts: validAmounts
            }
        });
    }
    
    // Generate test transaction
    const transactionId = 'RLR' + Date.now();
    const operatorId = 'TEST_' + Math.random().toString(36).substring(7);
    
    console.log('✅ Test transaction:', transactionId);
    
    // Return success response
    res.json({
        success: true,
        transaction: {
            id: transactionId,
            status: 'SUCCESS',
            amount: amount,
            phone: phone,
            reference: reference || '',
            operatorTransactionId: operatorId,
            processedAt: new Date().toISOString(),
            currency: 'MXN'
        },
        message: 'Top-up processed successfully (TEST MODE)'
    });
});

// Balance endpoint - TEST MODE
app.get('/api/balance', (req, res) => {
    const apiKey = req.headers['x-api-key'];
    const customerId = req.headers['x-customer-id'];
    
    if (apiKey !== 'enviadespensa_prod_2025' || customerId !== 'ENVIADESPENSA_001') {
        return res.status(401).json({ 
            success: false, 
            error: 'Invalid API credentials' 
        });
    }
    
    res.json({
        success: true,
        customer_id: 'ENVIADESPENSA_001',
        company_name: 'EnviaDespensa',
        current_balance: 10000,
        credit_limit: 10000,
        currency: 'MXN',
        mode: 'TEST_MODE'
    });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
    console.log('📍 TEST MODE - No database required');
    console.log('🎯 EnviaDespensa can test NOW!');
    console.log('');
    console.log('Endpoints ready:');
    console.log('  POST /api/enviadespensa/topup');
    console.log('  GET  /api/balance');
    console.log('  GET  /health');
});
