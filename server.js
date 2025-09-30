if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}
const express = require('express');
const crypto = require('crypto');
const db = require('./database');
const nodemailer = require('nodemailer');
const cron = require('node-cron');
const bcrypt = require('bcrypt');
const session = require('express-session');
const twilio = process.env.TWILIO_SID ? require('twilio')(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN) : null;

const app = express();
app.use(express.json());
app.use(session({ secret: 'secretkeychange', resave: false, saveUninitialized: true }));
app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
    console.log('Request received:', req.method, req.url);
    next();
});


const LATCOM_CONFIG = {
    username: process.env.LATCOM_USERNAME,
    password: process.env.LATCOM_PASSWORD,
    dist_api: process.env.LATCOM_DIST_API,
    user_uid: process.env.LATCOM_USER_UID,
    base_url: "https://lattest.mitopup.com/api"
};

let latcomToken = null;
let tokenExpiry = 0;

const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: false,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

async function sendAlert(message) {
    transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: process.env.EMAIL_USER,
        subject: 'Alert from Middleware',
        text: message
    });

    if (twilio) {
        twilio.messages.create({
            body: message,
            from: process.env.TWILIO_PHONE,
            to: process.env.ALERT_PHONE
        });
    }
}

function generateApiKey() {
    return 'ak_' + crypto.randomBytes(16).toString('hex');
}

function generateTransactionId() {
    return 'txn_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex');
}

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
            tokenExpiry = Date.now() + (30 * 60 * 1000);
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

async function getLatcomProducts() {
    try {
        console.log('Getting LATCOM products...');
        
        if (!latcomToken || Date.now() > (tokenExpiry - 300000)) {
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
        
        const response = await axios.post(`${LATCOM_CONFIG.base_url}/tn/fast`, {
            targetMSISDN: destination.replace(/^\+52/, ""), 
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

function authenticateApiKey(req, res, next) {
    const apiKey = req.headers['x-api-key'];
    
    if (!apiKey) {
        return res.status(401).json({ 
            success: false, 
            error: 'Missing API key' 
        });
    }
    
    db.getCustomerByApiKey(apiKey).then(customer => {
        if (!customer) {
            return res.status(401).json({ 
                success: false, 
                error: 'Invalid or inactive API key' 
            });
        }
        req.customer = customer;
        next();
    }).catch(error => {
        console.error('Auth error:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    });
}

app.get('/health', (req, res) => {
    res.json({
        status: "healthy",
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

app.get('/products', authenticateApiKey, async (req, res) => {
    try {
        const products = await getLatcomProducts();
        
        if (!products || products.length === 0) {
            return res.status(500).json({
                success: false,
                error: "Failed to fetch products"
            });
        }
        
        const productsWithoutMarkup = products.map(product => ({
            vendorName: product.vendorName,
            productType: product.productType,
            amount: product.amount,
            skuId: product.skuId,
            productDenominationName: product.productDenominatioName,
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

app.post('/topup', authenticateApiKey, async (req, res) => {
    const { destination, amount, currency = 'USD', reference, product_id, sku_id, service } = req.body;
    if (!destination || !amount || !product_id || !sku_id || !service) {
        return res.status(400).json({ success: false, error: 'Missing parameters' });
    }
    
    const transactionId = generateTransactionId();
    const customer = req.customer;
    const today = new Date().toISOString().split('T')[0];
    const dailyUsed = await db.getDailyUsed(customer.customer_id, today);
    const dailyRemaining = customer.daily_limit - dailyUsed;
    
    if (amount > customer.balance || amount > dailyRemaining) {
        return res.status(400).json({ 
            success: false, 
            error: amount > customer.balance ? 'Insufficient balance' : 'Daily limit exceeded' 
        });
    }
    
    const provider = await db.getProviderByName('latcom');
    const actualCost = amount / 1.24; // Your original profit calc - adjust if different (e.g., 24% profit)
    if (provider.current_used + actualCost > provider.credit_limit) {
        await sendAlert(`Latcom credit limit exceeded! Current: ${provider.current_used}, Limit: ${provider.credit_limit}`);
        return res.status(500).json({ success: false, error: 'Provider limit exceeded' });
    }
    
    try {
        const latcomResult = await processLatcomTopup(product_id, sku_id, service, destination, actualCost, reference);
        
        const status = latcomResult.status === 'Success' ? 'Success' : 'Fail';
        const failureCode = status === 'Fail' ? latcomResult.responseMessage || 'Unknown error' : null;
        
        const txnData = {
            transaction_id: transactionId,
            provider_transaction_id: latcomResult.transId,
            customer_id: customer.customer_id,
            destination_number: destination,
            customer_amount: amount,
            wholesale_cost: actualCost,
            status,
            provider_status: latcomResult.status,
            failure_code: failureCode,
            request_data: req.body,
            response_data: latcomResult
        };
        
        await db.insertTransaction(txnData);
        
        if (status === 'Success') {
            await db.updateCustomerBalance(customer.customer_id, amount);
            await db.updateProviderUsed('latcom', actualCost);
            const newUsed = provider.current_used + actualCost;
            if (newUsed / provider.credit_limit >= provider.alert_threshold) {
                await sendAlert(`Latcom credit at ${((newUsed / provider.credit_limit) * 100).toFixed(2)}%! Current: ${newUsed}, Limit: ${provider.credit_limit}`);
            }
        }
        
        res.json({
            success: status === 'Success',
            transactionId: transactionId,
            latcomTransactionId: latcomResult.transId,
            amount: amount,
            originalAmount: actualCost,
            destination: destination,
            status: latcomResult.status,
            message: latcomResult.responseMessage || 'Transaction processed',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        const txnData = {
            transaction_id: transactionId,
            provider_transaction_id: null,
            customer_id: customer.customer_id,
            destination_number: destination,
            customer_amount: amount,
            wholesale_cost: actualCost,
            status: 'Fail',
            provider_status: 'Error',
            failure_code: error.message,
            request_data: req.body,
            response_data: { error: error.message }
        };
        await db.insertTransaction(txnData);
        
        res.status(500).json({
            success: false,
            transactionId: transactionId,
            error: "Transaction processing failed",
            message: error.message
        });
    }
});

app.get('/transaction/:id', authenticateApiKey, async (req, res) => {
    try {
        const txn = await db.pool.query('SELECT * FROM transactions WHERE transaction_id = $1 AND customer_id = $2', [req.params.id, req.customer.customer_id]);
        if (!txn.rows[0]) return res.status(404).json({ success: false, error: 'Transaction not found' });
        res.json({ success: true, transaction: txn.rows[0] });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

app.get('/transactions', authenticateApiKey, async (req, res) => {
    try {
        const txns = await db.pool.query('SELECT * FROM transactions WHERE customer_id = $1 ORDER BY created_at DESC LIMIT 50', [req.customer.customer_id]);
        res.json({ success: true, transactions: txns.rows, customer: req.customer.name });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

app.get('/account', authenticateApiKey, async (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    const dailyUsed = await db.getDailyUsed(req.customer.customer_id, today);
    res.json({
        success: true,
        customer: {
            id: req.customer.customer_id,
            name: req.customer.name,
            balance: req.customer.balance,
            dailyLimit: req.customer.daily_limit,
            dailyUsed: dailyUsed,
            dailyRemaining: req.customer.daily_limit - dailyUsed,
            markup: `${(req.customer.markup_percentage * 100)}%`,
            status: req.customer.active ? 'active' : 'inactive'
        }
    });
});

app.use((error, req, res, next) => {
    console.error('Unhandled error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
});

function checkAuth(req, res, next) {
    if (req.session.loggedIn) {
        next();
    } else {
        res.redirect('/login');
    }
}

app.get('/login', (req, res) => {
    res.render('login', { error: null });
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const admin = await db.getAdminByUsername(username);
    if (admin && await bcrypt.compare(password, admin.password_hash)) {
        req.session.loggedIn = true;
        res.redirect('/dashboard');
    } else {
        res.render('login', { error: 'Invalid credentials' });
    }
});

app.get('/dashboard', checkAuth, async (req, res) => {
    const transactions = await db.getTransactionsLive();
    const customers = await db.getCustomers();
    const providers = await db.getProviders();
    res.render('dashboard', { transactions, customers, providers });
});

app.get('/reports/daily', checkAuth, async (req, res) => {
    const date = req.query.date || new Date().toISOString().split('T')[0];
    const report = await db.getDailyReport(date);
    res.render('report', { title: 'Daily Completed Transactions', data: report });
});

app.get('/reports/log', checkAuth, async (req, res) => {
    const date = req.query.date || new Date().toISOString().split('T')[0];
    const log = await db.getFullLog(date);
    res.render('report', { title: 'Full Transaction Log', data: log });
});

cron.schedule('0 0 * * *', async () => {
    const today = new Date().toISOString().split('T')[0];
    const report = await db.getDailyReport(today);
    const log = await db.getFullLog(today);
    const message = `Daily Report for ${today}:\nCompleted transactions: ${report.length}\nTotal log entries: ${log.length}\nRevenue: ${report.reduce((sum, t) => sum + t.customer_amount, 0).toFixed(2)}\nCost: ${report.reduce((sum, t) => sum + t.wholesale_cost, 0).toFixed(2)}\nProfit: ${report.reduce((sum, t) => sum + t.profit, 0).toFixed(2)}`;
    transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: process.env.EMAIL_USER,
        subject: 'Daily Transaction Report',
        text: message
    });
});


// Test transaction endpoint
app.post('/api/test-transaction', async (req, res) => {
    try {
        const { amount } = req.body;
        const { calculatePricing } = require('./pricing');
        const pricing = calculatePricing(amount);
        
        res.json({
            success: true,
            pricing: pricing,
            message: `Would send ${pricing.amountToProvider} to LATCOM as ${pricing.productType}`
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});


// Get Available Products from LATCOM
app.get('/api/latcom-products', async (req, res) => {
    try {
        const axios = require('axios');
        
        const loginResponse = await axios.post('https://lattest.mitopup.com/api/dislogin', {
            username: process.env.LATCOM_USERNAME,
            password: process.env.LATCOM_PASSWORD,
            dist_api: process.env.LATCOM_DIST_API,
            user_uid: process.env.LATCOM_USER_UID
        });
        
        const productsResponse = await axios.get('https://lattest.mitopup.com/api/gp', {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${loginResponse.data.access}`
            }
        });
        
        res.json({
            success: true,
            products: productsResponse.data
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.response ? error.response.data : error.message
        });
    }
});


// LATCOM Test Endpoint
app.post('/api/test-latcom', async (req, res) => {
    try {
        const axios = require('axios');
        
        // Test login
        const loginResponse = await axios.post('https://lattest.mitopup.com/api/dislogin', {
            username: process.env.LATCOM_USERNAME,
            password: process.env.LATCOM_PASSWORD,
            dist_api: process.env.LATCOM_DIST_API,
            user_uid: process.env.LATCOM_USER_UID
        }, {
            headers: { 'Content-Type': 'application/json' }
        });
        
        res.json({
            success: true,
            message: 'LATCOM login successful',
            token: loginResponse.data.access.substring(0, 20) + '...'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.response ? error.response.data : error.message
        });
    }
});


// Transaction Processing Endpoint
// Transaction Processing Endpoint with Customer Discount Lookup
app.post('/api/transaction', async (req, res) => {
    try {
        const { amount, phone, customerId, apiKey } = req.body;
if (!amount || !phone) {
            return res.status(400).json({ success: false, error: 'Missing amount or phone' });
        }        
        
        let customerDiscountRate = 0.10;
        let customerRecord = null;
        
        if (apiKey) {
            const result = await db.query(
                'SELECT id, name, discount_rate FROM customers WHERE api_key = $1 AND active = true',
                [apiKey]
            );
            if (result.rows.length > 0) {
                customerRecord = result.rows[0];
                customerDiscountRate = parseFloat(customerRecord.discount_rate);
            } else {
                return res.status(401).json({ success: false, error: 'Invalid API key' });
            }
        }
        
        const { calculatePricing } = require('./pricing');
        const { selectProduct } = require('./products');
        const axios = require('axios');
        
        const pricing = calculatePricing(amount, customerDiscountRate);
        const product = selectProduct(pricing.amountToProvider, pricing.productType);
        const transactionId = `LT${Date.now()}${Math.floor(Math.random() * 1000)}`;
        
        const loginResponse = await axios.post('https://lattest.mitopup.com/api/dislogin', {
            username: process.env.LATCOM_USERNAME,
            password: process.env.LATCOM_PASSWORD,
            dist_api: process.env.LATCOM_DIST_API,
            user_uid: process.env.LATCOM_USER_UID
        });
        
        const latcomResponse = await axios.post('https://lattest.mitopup.com/api/tn/fast', {
            targetMSISDN: phone.replace(/^\+52/, ""),
            dist_transid: transactionId,
            operator: 'TELEFONICA',
            country: 'MEXICO',
            currency: 'USD',
            amount: product.amount,
            skuID: product.skuId,
            service: product.service
        }, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${loginResponse.data.access}`
            }
        });
        
        await db.query(`
            INSERT INTO transactions (
                transaction_id, customer_id, status, product_type,
                customer_amount, customer_discount, forex_spread,
                amount_to_provider, provider_discount, wholesale_cost,
                margin_retained, profit, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
        `, [
            transactionId,
            customerRecord ? customerRecord.id : null,
            latcomResponse.data.status || 'SUCCESS',
            pricing.productType,
            pricing.customerRequestAmount,
            pricing.customerDiscount,
            0,
            pricing.amountToProvider,
            pricing.providerDiscount,
            pricing.wholesaleCost,
            pricing.marginRetained,
            pricing.profit
        ]);
        
        res.json({
            success: true,
            transactionId: transactionId,
            latcomResponse: latcomResponse.data,
            pricing: {
                ...pricing,
                customerDiscountApplied: `${(customerDiscountRate * 100).toFixed(1)}%`
            }
        });
    } catch (error) {
        console.error('Transaction error:', error);
        res.status(500).json({ success: false, error: error.response ? error.response.data : error.message });
    }
});




// Customer Management Endpoints

// Create new customer
app.post('/api/admin/customers', async (req, res) => {
    try {
        const { name, discountRate, dailyLimit } = req.body;
        
            if (!name || !discountRate) {
            return res.status(400).json({ success: false, error: 'Missing name or discountRate' });
        }
        
        // Generate API key
        const crypto = require('crypto');
        const apiKey = crypto.randomBytes(32).toString('hex');
        
        await db.query(`
            INSERT INTO customers (name, discount_rate, api_key, daily_limit, balance)
            VALUES ($1, $2, $3, $4, 0)
        `, [name, discountRate, apiKey, dailyLimit || 10000]);
        
        res.json({
            success: true,
            customer: { name, discountRate, apiKey }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get customer info (for customer to see their discount)
app.get('/api/customer/info', async (req, res) => {
    try {
        const apiKey = req.headers['x-api-key'];
        
         if (!apiKey) {
            return res.status(401).json({ success: false, error: 'API key required' });
        }
        
        const result = await db.query(
            'SELECT name, discount_rate, daily_limit, balance FROM customers WHERE api_key = $1 AND active = true',
            [apiKey]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Customer not found' });
        }
        
        const customer = result.rows[0];
        res.json({
            success: true,
            customer: {
                name: customer.name,
                discountRate: parseFloat(customer.discount_rate),
                discountPercentage: (parseFloat(customer.discount_rate) * 100).toFixed(1) + '%',
                dailyLimit: parseFloat(customer.daily_limit),
                balance: parseFloat(customer.balance)
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});


// 404 handler - MUST BE LAST
app.use((req, res) => {
    res.status(404).json({ success: false, error: 'Endpoint not found' });
});




// Start server
const PORT = process.env.PORT || 3000;


app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    console.log('DATABASE_URL:', process.env.DATABASE_URL);
    // Initialize database without blocking
    db.initializeDatabase()
        .then(() => console.log('✅ Database initialized'))
        .catch(err => console.error('❌ Database error:', err.message));
});

module.exports = app;

// Database test endpoint
app.get('/test-db', async (req, res) => {
    try {
        const result = await db.pool.query('SELECT NOW()');
        res.json({
            success: true,
            time: result.rows[0].now,
            dbUrl: process.env.DATABASE_URL ? 'Set' : 'Not set'
        });
    } catch (error) {
        res.json({
            success: false,
            error: error.message,
            dbUrl: process.env.DATABASE_URL ? 'Set' : 'Not set'
        });
    }
});

// TEST ENDPOINT - Direct LATCOM without database
app.post('/api/test-latcom', async (req, res) => {
    try {
        const { phone, amount } = req.body;
        console.log('Test LATCOM call:', { phone, amount });
        
        // Just return test response for now
        res.json({
            success: true,
            test: true,
            message: 'LATCOM test endpoint ready',
            received: { phone, amount }
        });
        
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});
// WORKING TEST ENDPOINT FOR LATCOM
app.post('/api/test-topup', async (req, res) => {
    try {
        const { phone, amount, type = 'topup' } = req.body;
        
        console.log('Test request:', { phone, amount, type });
        
        // Step 1: Login to LATCOM
        const loginPayload = {
            username: process.env.LATCOM_USERNAME || 'enviadespensa',
            password: process.env.LATCOM_PASSWORD || 'ENV!d32025#',
            user_uid: process.env.LATCOM_USER_UID || '20060916',
            dist_api: process.env.LATCOM_DIST_API || '38aa13413d1431fba1824f2633c2b7d67f5fffcb91b043629a0d1fe09df2fb8d'
        };
        
        console.log('Login with:', { username: loginPayload.username, user_uid: loginPayload.user_uid });
        
        const loginResponse = await axios.post('https://lattest.mitopup.com/api/dislogin', loginPayload);
        const token = loginResponse.data.access;
        console.log('Got token:', token ? 'Yes' : 'No');
        
        // Step 2: Prepare topup based on type
        let latcomPayload;
        
        if (type === 'bundle') {
            // Bundle example
            latcomPayload = {
                targetMSISDN: phone.replace(/^\+52/, '').replace(/^52/, ''),
                dist_transid: `BUNDLE${Date.now()}`,
                operator: "TELEFONICA",
                country: "MEXICO",
                currency: "USD",
                amount: 0,
                productId: "TEMXN_BFRIQUIN_28_DAYS",
                skuID: "BFRIQUIN",
                service: 1
            };
        } else {
            // Topup example (default)
            latcomPayload = {
                targetMSISDN: phone.replace(/^\+52/, '').replace(/^52/, ''),
                dist_transid: `TOPUP${Date.now()}`,
                operator: "TELEFONICA",
                country: "MEXICO",
                currency: "USD",
                amount: amount || 10,
                productId: "TFE_MEXICO_TOPUP_103_2579_MXN",
                skuID: "0",
                service: 2
            };
        }
        
        console.log('Sending to LATCOM:', latcomPayload);
        
        // Step 3: Send to LATCOM
        const latcomResponse = await axios.post(
            'https://lattest.mitopup.com/api/tn/fast',
            latcomPayload,
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            }
        );
        
        res.json({
            success: true,
            response: latcomResponse.data,
            transactionId: latcomPayload.dist_transid
        });
        
    } catch (error) {
        console.error('Error details:', error.response?.data || error.message);
        res.status(500).json({
            success: false,
            error: error.response?.data || error.message,
            details: error.response?.data
        });
    }
});

// CUSTOMER-FACING ENDPOINT (What CSQ will call)
app.post('/api/customer/topup', async (req, res) => {
    try {
        const apiKey = req.headers['x-api-key'];
        const { phone, amount } = req.body;
        
        // Validate API key
        if (apiKey !== 'csq_customer_001' && apiKey !== 'relier_client_2025') {
            return res.status(401).json({ success: false, error: 'Invalid API key' });
        }
        
        // Apply customer discount (18% for CSQ)
        const customerDiscount = apiKey === 'csq_customer_001' ? 0.18 : 0.10;
        const finalAmount = amount * (1 - customerDiscount);
        
        // Here you would call the LATCOM API
        // For now, just return the calculation
        
        res.json({
            success: true,
            customer: apiKey,
            requestedAmount: amount,
            discount: `${customerDiscount * 100}%`,
            chargedAmount: finalAmount,
            message: 'Ready for processing'
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// EXACT LATCOM TEST - Matches Sagar's format
app.post('/api/exact-test', async (req, res) => {
    try {
        const axios = require('axios');
        
        // Login
        const loginResponse = await axios.post('https://lattest.mitopup.com/api/dislogin', {
            username: 'enviadespensa',
            password: 'ENV!d32025#',
            user_uid: '20060916',
            dist_api: '38aa13413d1431fba1824f2633c2b7d67f5fffcb91b043629a0d1fe09df2fb8d'
        });
        
        // Exact format from Sagar
        const latcomResponse = await axios.post(
            'https://lattest.mitopup.com/api/tn/fast',
            {
                targetMSISDN: "5615911142",
                dist_transid: `TEST${Date.now()}`,
                operator: "TELEFONICA",
                country: "MEXICO",
                currency: "USD",
                amount: 10,
                productId: "TFE_MEXICO_TOPUP_103_2579_MXN",
                skuID: "0",
                service: 2
            },
            {
                headers: {
                    'Authorization': `Bearer ${loginResponse.data.access}`
                }
            }
        );
        
        res.json({
            success: true,
            response: latcomResponse.data
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.response?.data || error.message
        });
    }
});
// Deploy trigger Mon Sep 29 23:24:51 EDT 2025
// CSQ TEST ENDPOINT
app.post('/api/csq/topup', async (req, res) => {
    const axios = require('axios');
    const { phone, amount = 10 } = req.body;
    
    try {
        const loginResponse = await axios.post('https://lattest.mitopup.com/api/dislogin', {
            username: 'enviadespensa',
            password: 'ENV!d32025#',
            user_uid: '20060916',
            dist_api: '38aa13413d1431fba1824f2633c2b7d67f5fffcb91b043629a0d1fe09df2fb8d'
        });
        
        const topupResponse = await axios.post('https://lattest.mitopup.com/api/tn/fast', {
            targetMSISDN: phone.replace(/^\+52/, '').replace(/^52/, ''),
            dist_transid: `CSQ${Date.now()}`,
            operator: "TELEFONICA",
            country: "MEXICO",
            currency: "USD",
            amount: 10,
            productId: "TFE_MEXICO_TOPUP_103_2579_MXN",
            skuID: "0",
            service: 2
        }, {
            headers: { 'Authorization': `Bearer ${loginResponse.data.access}` }
        });
        
        res.json({ success: true, result: topupResponse.data });
    } catch (err) {
        res.json({ success: false, error: err.response?.data || err.message });
    }
});
