const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const DatabaseManager = require('./database');
const db = new DatabaseManager();

const app = express();
app.use(express.json());

// LATCOM Configuration with Sagar's credentials
const LATCOM_CONFIG = {
    username: "enviadespensa",
    password: "ENV!d32025#",
    dist_api: "38aa13413d1431fba1824f2633c2b7d67f5fffcb91b043629a0d1fe09df2fb8d",
    user_uid: "20060916",
    base_url: "https://lattest.mitopup.com/api"
};

// In-memory storage
let customers = {};
let transactions = {};
let latcomToken = null;
let tokenExpiry = 0;  // Force immediate refresh

// Customer database
const sampleCustomers = {
    "api_key_12345": {
        id: "customer_001",
        name: "Customer A",
        apiKey: "api_key_12345",
        active: true,
        balance: 1000.00,
        markup: 0.00, // Customer sees face value (24% profit is internal)
        dailyLimit: 5000,
        dailyUsed: 0,
        created: new Date().toISOString()
    },
"relier_client_2025": {
        id: "client_001", 
        name: "Cliente Relier",
        apiKey: "relier_client_2025",
        active: true,
        balance: 5000.00,
        markup: 0.00,
        dailyLimit: 10000,
        dailyUsed: 0,
        created: new Date().toISOString()
}
};

// Initialize customers
customers = { ...sampleCustomers };

// Utility functions
function generateApiKey() {
    return 'ak_' + crypto.randomBytes(16).toString('hex');
}

function generateTransactionId() {
    return 'txn_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex');
}

async function logTransaction(customerId, type, data, status) {
    const txnId = generateTransactionId();
    transactions[txnId] = {
        id: txnId,
        customerId: customerId,
        type: type,
        data: data,
        status: status,
        timestamp: new Date().toISOString()
    };
    console.log(`Transaction logged: ${txnId} - ${status}`);
    return txnId;
}

// Authentication middleware
function authenticateApiKey(req, res, next) {
    const apiKey = req.headers['x-api-key'];
    
    if (!apiKey) {
        return res.status(401).json({ 
            success: false, 
            error: 'Missing API key' 
        });
    }
    
    const customer = customers[apiKey];
    if (!customer || !customer.active) {
        return res.status(401).json({ 
            success: false, 
            error: 'Invalid or inactive API key' 
        });
    }
    
    req.customer = customer;
    next();
}

// LATCOM Authentication Function
async function authenticateLatcom() {
    try {
        console.log('Authenticating with LATCOM...');
        const response = await axios.post(`${LATCOM_CONFIG.base_url}/dislogin`, {
            username: LATCOM_CONFIG.username,
            password: LATCOM_CONFIG.password,
            dist_api: LATCOM_CONFIG.dist_api,
            user_uid: LATCOM_CONFIG.user_uid
        }, {
            headers: { 'Content-Type': 'application/json' }
        });
        
        console.log('LATCOM auth response:', response.data);
        
        if (response.data && response.data.access) {
    latcomToken = response.data.access;
    tokenExpiry = Date.now() + (30 * 60 * 1000); // 30 minutes instead of 4 hours
            console.log('LATCOM authentication successful');
            return latcomToken;
        }
        throw new Error('LATCOM authentication failed - no access token');
    } catch (error) {
        console.error('LATCOM auth error:', error.message);
        if (error.response) {
            console.error('LATCOM auth response:', error.response.data);
        }
        throw error;
    }
}

// LATCOM Get Products Function
async function getLatcomProducts() {
    try {
        console.log('Getting LATCOM products...');
        
        if (!latcomToken || Date.now() > (tokenExpiry - 300000)) { // Refresh 5 minutes early
            await authenticateLatcom();
        }
        
        const response = await axios.get(`${LATCOM_CONFIG.base_url}/gp`, {
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${latcomToken}` 
            }
        });
        
        console.log('LATCOM products raw response:', JSON.stringify(response.data, null, 2));
        return response.data || [];
        
    } catch (error) {
        console.error('LATCOM products error:', error.message);
        if (error.response) {
            console.error('LATCOM products response:', error.response.data);
        }
        return [];
    }
}

// LATCOM Process Topup Function - FIXED with Sagar's corrections
async function processLatcomTopup(productId, skuId, service, destination, amount, reference) {
    try {
        console.log('Processing LATCOM topup...');
        console.log('LATCOM request data:', JSON.stringify({
    targetMSISDN: destination.replace(/^\+52/, ""), 
    dist_transid: reference || generateTransactionId(),
    operator: "TELEFONICA",
    country: "MEXICO", 
    currency: "USD",
    amount: amount,
    productId: productId,
    skuID: skuId,
    service: service
}, null, 2));
        
        if (!latcomToken || Date.now() > tokenExpiry) {
            await authenticateLatcom();
        }
        
        // Apply Sagar's fixes:
        // 1. Remove +52 from phone number
        // 2. Use skuID instead of productId
        // 3. Send correct amount
        const response = await axios.post(`${LATCOM_CONFIG.base_url}/tn/fast`, {
            targetMSISDN: destination.replace(/^\+52/, ""), // Remove +52 country code
            dist_transid: reference || generateTransactionId(),
            operator: "TELEFONICA",
            country: "MEXICO",
            currency: "USD",
            amount: amount,
            skuID: skuId,
            productId: productId,
            service: service
        }, {
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${latcomToken}` 
            }
        });
        
        console.log('LATCOM topup response:', response.data);
        return response.data;
        
    } catch (error) {
        console.error('LATCOM topup error:', error.message);
        if (error.response) {
            console.error('LATCOM topup response:', error.response.data);
        }
        throw error;
    }
}

// API Routes

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: "healthy",
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Get available products
app.get('/products', authenticateApiKey, async (req, res) => {
    try {
        const products = await getLatcomProducts();
        
        if (!products || products.length === 0) {
            return res.status(500).json({
                success: false,
                error: "Failed to fetch products"
            });
        }
        
        // Show original LATCOM prices (no markup displayed)
        const productsWithoutMarkup = products.map(product => ({
    vendorName: product.vendorName,
    productType: product.productType,
    amount: product.amount,
    skuId: product.skuId,
    productDenominationName: product.productDenominatioName,  // Note: LATCOM has typo in field name
    currency: product.currency || "USD",
    product: product.product,
    productCategory: product.productCategory
}));
        
        res.json({
            success: true,
            data: productsWithoutMarkup,
            customer: req.customer.name
        });
        
    } catch (error) {
        console.error('Products endpoint error:', error);
        res.status(500).json({
            success: false,
            error: "Failed to fetch products"
        });
    }
});

// Process topup transaction
app.post('/topup', authenticateApiKey, async (req, res) => {
    try {
        const { destination, amount, currency = 'USD', reference, product_id } = req.body;
        
        if (!destination || (amount !== 0 && !amount)) {
            return res.status(400).json({
                success: false,
                error: "Missing required fields: destination, amount"
            });
        }
        
        // Check customer balance and limits
        if (req.customer.balance < amount) {
            return res.status(403).json({
                success: false,
                error: "Insufficient balance"
            });
        }
        // Look up product details to determine if it's topup or bundle
        const products = await getLatcomProducts();
        const productDetails = products.find(p => 
            p.productDenominatioName === product_id || p.skuId === product_id
        );

        if (!productDetails) {
            return res.status(400).json({
                success: false,
                error: "Product not found"
            });
        }

        // Determine product type and set correct values
        const isTopup = productDetails.skuId === "0";
        const latcomProductId = productDetails.productDenominatioName;
        const latcomSkuId = productDetails.skuId;
        const serviceType = isTopup ? 2 : 1;
        const today = new Date().toDateString();
        const todayTransactions = Object.values(transactions)
            .filter(t => t.customerId === req.customer.id && 
                    new Date(t.timestamp).toDateString() === today);
        const dailyUsed = todayTransactions.reduce((sum, t) => sum + (t.data.amount || 0), 0);
        
        if (dailyUsed + amount > req.customer.dailyLimit) {
            return res.status(403).json({
                success: false,
                error: "Daily limit exceeded"
            });
        }
        
        // Create transaction record
        const transactionId = generateTransactionId();

        // Internal accounting (24% discount from LATCOM)
        const listPrice = amount; // What customer pays
        const actualCost = listPrice * 0.76; // Your cost after 24% discount
        const actualProfit = listPrice - actualCost; // Your profit

        // Log for accounting (internal only)
        console.log(`PROFIT: Customer pays $${listPrice}, Your cost $${actualCost.toFixed(2)}, Profit $${actualProfit.toFixed(2)}`);

        // Use actual cost for LATCOM transaction
        const originalAmount = actualCost;
        
        try {
            // Process with LATCOM using corrected format
            const latcomResult = await processLatcomTopup(latcomProductId, latcomSkuId, serviceType, destination, originalAmount, reference);
            
            // Log transaction
            await logTransaction(req.customer.id, 'topup', {
                destination,
                amount,
                originalAmount,
                currency,
                reference,
                product_id,
                latcomResult
            }, latcomResult.status || 'completed');
            
            // Update customer balance if successful
            if (latcomResult.status === 'Success') {
                customers[req.customer.apiKey].balance -= amount;
                customers[req.customer.apiKey].dailyUsed = dailyUsed + amount;
            }
            
            res.json({
                success: latcomResult.status === 'Success',
                transactionId: transactionId,
                latcomTransactionId: latcomResult.transId,
                amount: amount,
                originalAmount: originalAmount,
                destination: destination,
                status: latcomResult.status,
                message: latcomResult.responseMessage || 'Transaction processed',
                timestamp: new Date().toISOString()
            });
            
        } catch (providerError) {
            await logTransaction(req.customer.id, 'topup', {
                destination,
                amount,
                currency,
                reference,
                error: providerError.message
            }, 'failed');
            
            res.status(500).json({
                success: false,
                transactionId: transactionId,
                error: "Transaction processing failed",
                message: providerError.message
            });
        }
        
    } catch (error) {
        console.error('Topup endpoint error:', error);
        res.status(500).json({
            success: false,
            error: "Transaction processing failed"
        });
    }
});

// Get transaction status
app.get('/transaction/:id', authenticateApiKey, (req, res) => {
    const transactionId = req.params.id;
    const transaction = transactions[transactionId];
    
    if (!transaction || transaction.customerId !== req.customer.id) {
        return res.status(404).json({
            success: false,
            error: "Transaction not found"
        });
    }
    
    res.json({
        success: true,
        transaction: transaction
    });
});

// Get customer transactions
app.get('/transactions', authenticateApiKey, (req, res) => {
    const customerTransactions = Object.values(transactions)
        .filter(t => t.customerId === req.customer.id)
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, 50); // Last 50 transactions
    
    res.json({
        success: true,
        transactions: customerTransactions,
        customer: req.customer.name
    });
});

// Customer account info
app.get('/account', authenticateApiKey, (req, res) => {
    const today = new Date().toDateString();
    const todayTransactions = Object.values(transactions)
        .filter(t => t.customerId === req.customer.id && 
                new Date(t.timestamp).toDateString() === today);
    const dailyUsed = todayTransactions.reduce((sum, t) => sum + (t.data.amount || 0), 0);
    
    res.json({
        success: true,
        customer: {
            id: req.customer.id,
            name: req.customer.name,
            balance: req.customer.balance,
            dailyLimit: req.customer.dailyLimit,
            dailyUsed: dailyUsed,
            dailyRemaining: req.customer.dailyLimit - dailyUsed,
            markup: `${(req.customer.markup * 100)}%`,
            status: req.customer.active ? 'active' : 'inactive'
        },
        todayStats: {
            transactions: todayTransactions.length,
            volume: dailyUsed
        }
    });
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Unhandled error:', error);
    res.status(500).json({
        success: false,
        error: 'Internal server error'
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found'
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
    console.log(`Server running on port ${PORT}`);
    
    try {
        await db.initializeDatabase();
        console.log('Database connected and initialized');
    } catch (error) {
        console.error('Database initialization failed:', error);
    }
});

module.exports = app;
// ============= LINK SAVER API ROUTES =============
// Routes for Chrome Extension

// Get all links
app.get('/api/links', async (req, res) => {
  try {
    const links = await db.getLinks();
    res.json(links || []);
  } catch (error) {
    console.error('Error getting links:', error);
    res.json([]);
  }
});

// Get quick links
app.get('/api/quicklinks', async (req, res) => {
  try {
    const links = await db.getQuickLinks();
    res.json(links || []);
  } catch (error) {
    console.error('Error getting quick links:', error);
    res.json([]);
  }
});

// Create a new link
app.post('/api/links', async (req, res) => {
  try {
    const { url, title, category } = req.body;
    const link = await db.createLink({ url, title, category });
    res.json({ success: true, link });
  } catch (error) {
    console.error('Error creating link:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete a link
app.delete('/api/links/:id', async (req, res) => {
  try {
    await db.deleteLink(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting link:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});


// ============= BILLING ENDPOINTS =============

// Get billing summary for a customer
app.get('/api/billing/summary/:customerId', authenticateApiKey, async (req, res) => {
    try {
        const { customerId } = req.params;
        const { month, year } = req.query;
        
        // Get transactions for the period
        const customerTxns = Object.values(transactions)
            .filter(t => t.customerId === customerId);
        
        const successfulTxns = customerTxns.filter(t => t.status === 'Success');
        const failedTxns = customerTxns.filter(t => t.status === 'Fail');
        
        // Calculate totals
        const totalRevenue = successfulTxns.reduce((sum, t) => sum + (t.data.amount || 0), 0);
        const totalCost = successfulTxns.reduce((sum, t) => sum + (t.data.originalAmount || 0), 0);
        const totalProfit = totalRevenue - totalCost;
        
        res.json({
            success: true,
            customerId: customerId,
            period: { month, year },
            summary: {
                totalTransactions: customerTxns.length,
                successfulTransactions: successfulTxns.length,
                failedTransactions: failedTxns.length,
                totalRevenue: totalRevenue.toFixed(2),
                totalCost: totalCost.toFixed(2),
                totalProfit: totalProfit.toFixed(2),
                profitMargin: ((totalProfit / totalRevenue) * 100).toFixed(2) + '%'
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

