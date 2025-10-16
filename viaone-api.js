/**
 * Via.One Retail System - API Endpoints
 * Store POS and Owner Dashboard Backend
 */

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'viaone_secret_key_change_in_production';

module.exports = function(app, pool) {

    // ==========================================
    // AUTHENTICATION
    // ==========================================

    // Store Login
    app.post('/api/store/login', async (req, res) => {
        const { username, password } = req.body;

        try {
            const result = await pool.query(
                'SELECT * FROM stores WHERE username = $1 AND is_active = true',
                [username]
            );

            if (result.rows.length === 0) {
                return res.status(401).json({ success: false, error: 'Invalid credentials' });
            }

            const store = result.rows[0];

            // Verify password
            const passwordMatch = await bcrypt.compare(password, store.password_hash);

            if (!passwordMatch) {
                return res.status(401).json({ success: false, error: 'Invalid credentials' });
            }

            // Generate JWT token
            const token = jwt.sign(
                { store_id: store.store_id, username: store.username },
                JWT_SECRET,
                { expiresIn: '12h' }
            );

            // Update last login
            await pool.query(
                'UPDATE stores SET last_login = NOW() WHERE store_id = $1',
                [store.store_id]
            );

            res.json({
                success: true,
                store_id: store.store_id,
                store_name: store.store_name,
                token: token
            });

        } catch (error) {
            console.error('Store login error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // Owner Login
    app.post('/api/owner/login', async (req, res) => {
        const { username, password } = req.body;

        // Simple owner login (hardcoded for now - improve in production)
        if (username === 'owner' && password === 'ownerpass123') {
            const token = jwt.sign(
                { owner_id: 'OWNER_001', username: 'owner' },
                JWT_SECRET,
                { expiresIn: '12h' }
            );

            res.json({
                success: true,
                owner_id: 'OWNER_001',
                token: token
            });
        } else {
            res.status(401).json({ success: false, error: 'Invalid credentials' });
        }
    });

    // Middleware to verify store token
    function verifyStoreToken(req, res, next) {
        const storeId = req.headers['x-store-id'];
        const token = req.headers['x-store-token'];

        if (!storeId || !token) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            if (decoded.store_id !== storeId) {
                return res.status(401).json({ success: false, error: 'Invalid token' });
            }
            req.store = decoded;
            next();
        } catch (error) {
            return res.status(401).json({ success: false, error: 'Invalid token' });
        }
    }

    // ==========================================
    // STORE OPERATIONS
    // ==========================================

    // Get store details and pricing
    app.get('/api/store/details', verifyStoreToken, async (req, res) => {
        try {
            const storeResult = await pool.query(
                'SELECT * FROM stores WHERE store_id = $1',
                [req.store.store_id]
            );

            if (storeResult.rows.length === 0) {
                return res.status(404).json({ success: false, error: 'Store not found' });
            }

            const pricingResult = await pool.query(
                'SELECT * FROM store_pricing WHERE store_id = $1 AND is_active = true',
                [req.store.store_id]
            );

            res.json({
                success: true,
                store_id: storeResult.rows[0].store_id,
                store_name: storeResult.rows[0].store_name,
                pricing: pricingResult.rows
            });

        } catch (error) {
            console.error('Get store details error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // Get today's stats for a store
    app.get('/api/store/stats/today', verifyStoreToken, async (req, res) => {
        try {
            const result = await pool.query(`
                SELECT
                    COUNT(*) as count,
                    COALESCE(SUM(amount + retail_fee), 0) as total,
                    COALESCE(SUM(profit), 0) as profit
                FROM store_transactions
                WHERE store_id = $1
                AND created_at >= CURRENT_DATE
                AND status = 'SUCCESS'
            `, [req.store.store_id]);

            res.json({
                count: parseInt(result.rows[0].count),
                total: parseFloat(result.rows[0].total),
                profit: parseFloat(result.rows[0].profit)
            });

        } catch (error) {
            console.error('Get store stats error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // Get available Mexico carriers from PPN
    app.get('/api/store/carriers', verifyStoreToken, async (req, res) => {
        try {
            const PPNProvider = require('./providers/ppn-provider');
            const ppn = new PPNProvider();

            // Get Mexico carriers from PPN
            const result = await ppn.getSKUs({ country: 'MX', type: 'topup' });

            if (result.success) {
                // Group by carrier/operator
                const carriers = {};

                result.skus.forEach(sku => {
                    const operator = sku.operator || sku.operatorName;
                    if (!carriers[operator]) {
                        carriers[operator] = {
                            name: operator,
                            logo: sku.logoUrl || null,
                            products: []
                        };
                    }
                    carriers[operator].products.push({
                        skuId: sku.skuId,
                        amount: sku.denomination || sku.amount,
                        currency: sku.currency || 'MXN',
                        name: sku.skuName
                    });
                });

                res.json({
                    success: true,
                    carriers: Object.values(carriers)
                });
            } else {
                // Fallback to hardcoded Mexico carriers
                res.json({
                    success: true,
                    carriers: [
                        { name: 'Telcel', logo: null, products: [
                            { skuId: 'telcel_20', amount: 20, currency: 'MXN' },
                            { skuId: 'telcel_30', amount: 30, currency: 'MXN' },
                            { skuId: 'telcel_50', amount: 50, currency: 'MXN' },
                            { skuId: 'telcel_100', amount: 100, currency: 'MXN' }
                        ]},
                        { name: 'AT&T', logo: null, products: [
                            { skuId: 'att_20', amount: 20, currency: 'MXN' },
                            { skuId: 'att_30', amount: 30, currency: 'MXN' },
                            { skuId: 'att_50', amount: 50, currency: 'MXN' },
                            { skuId: 'att_100', amount: 100, currency: 'MXN' }
                        ]},
                        { name: 'Movistar', logo: null, products: [
                            { skuId: 'movistar_20', amount: 20, currency: 'MXN' },
                            { skuId: 'movistar_30', amount: 30, currency: 'MXN' },
                            { skuId: 'movistar_50', amount: 50, currency: 'MXN' },
                            { skuId: 'movistar_100', amount: 100, currency: 'MXN' }
                        ]}
                    ]
                });
            }
        } catch (error) {
            console.error('Get carriers error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // Mobile Topup (PPN)
    app.post('/api/store/mobile-topup', verifyStoreToken, async (req, res) => {
        const { phone, amount, skuId, carrier } = req.body;
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            // Mobile topup has NO retail fee - automated % discount from our side
            // The store just processes the transaction, owner gets invoiced with discount
            const cost = parseFloat(amount); // Cost = face value
            const profit = 0; // No immediate profit tracking (handled in invoicing)

            // Call PPN provider (assuming we have PPN configured)
            const PPNProvider = require('./providers/ppn-provider');
            const ppn = new PPNProvider();

            const transactionId = `VIAONE_${req.store.store_id}_${Date.now()}`;

            const ppnResult = await ppn.topup({
                phone: phone,
                amount: amount,
                skuId: skuId,
                operator: carrier,
                reference: transactionId
            });

            const status = ppnResult.success ? 'SUCCESS' : 'FAILED';

            // Save transaction
            await client.query(`
                INSERT INTO store_transactions
                (transaction_id, store_id, product_type, phone, amount, retail_fee, cost, profit, status, provider, provider_transaction_id, provider_response)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            `, [
                transactionId,
                req.store.store_id,
                'mobile_topup',
                phone,
                amount,
                0, // No retail fee
                cost,
                profit,
                status,
                'PPN',
                ppnResult.providerTransactionId,
                JSON.stringify(ppnResult)
            ]);

            await client.query('COMMIT');

            if (ppnResult.success) {
                res.json({
                    success: true,
                    transaction_id: transactionId,
                    profit: profit,
                    message: 'Topup successful'
                });
            } else {
                res.status(500).json({
                    success: false,
                    error: ppnResult.message || 'Topup failed'
                });
            }

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Mobile topup error:', error);
            res.status(500).json({ success: false, error: error.message });
        } finally {
            client.release();
        }
    });

    // SPEI Transfer (MUWE)
    app.post('/api/store/spei', verifyStoreToken, async (req, res) => {
        const { accountNo, accountName, amount } = req.body;
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            // Get pricing
            const pricingResult = await client.query(
                `SELECT * FROM store_pricing
                 WHERE store_id = $1 AND product_type = 'spei' AND is_active = true`,
                [req.store.store_id]
            );

            if (pricingResult.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(400).json({ success: false, error: 'Product not configured' });
            }

            const pricing = pricingResult.rows[0];
            const retailFee = parseFloat(pricing.retail_fee);
            const cost = parseFloat(pricing.cost_per_transaction);
            const profit = retailFee - cost;

            // Call MUWE provider for SPEI
            const MUWEProvider = require('./providers/muwe-provider');
            const muwe = new MUWEProvider();

            const transactionId = `VIAONE_${req.store.store_id}_${Date.now()}`;

            const muweResult = await muwe.speiPayOut({
                accountNo: accountNo,
                accountName: accountName,
                amount: amount,
                reference: transactionId
            });

            const status = muweResult.success ? 'SUCCESS' : 'FAILED';

            // Save transaction
            await client.query(`
                INSERT INTO store_transactions
                (transaction_id, store_id, product_type, account_no, account_name, amount, retail_fee, cost, profit, status, provider, provider_transaction_id, provider_response)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            `, [
                transactionId,
                req.store.store_id,
                'spei',
                accountNo,
                accountName,
                amount,
                retailFee,
                cost,
                profit,
                status,
                'MUWE',
                muweResult.providerTransactionId,
                JSON.stringify(muweResult)
            ]);

            await client.query('COMMIT');

            if (muweResult.success) {
                res.json({
                    success: true,
                    transaction_id: transactionId,
                    profit: profit,
                    message: 'SPEI initiated successfully'
                });
            } else {
                res.status(500).json({
                    success: false,
                    error: muweResult.message || 'SPEI failed'
                });
            }

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('SPEI error:', error);
            res.status(500).json({ success: false, error: error.message });
        } finally {
            client.release();
        }
    });

    // OXXO Voucher (MUWE)
    app.post('/api/store/oxxo-voucher', verifyStoreToken, async (req, res) => {
        const { amount } = req.body;
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            // Get pricing
            const pricingResult = await client.query(
                `SELECT * FROM store_pricing
                 WHERE store_id = $1 AND product_type = 'oxxo_gift_card' AND is_active = true`,
                [req.store.store_id]
            );

            if (pricingResult.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(400).json({ success: false, error: 'Product not configured' });
            }

            const pricing = pricingResult.rows[0];
            const retailFee = parseFloat(pricing.retail_fee);
            const cost = parseFloat(pricing.cost_per_transaction);
            const profit = retailFee - cost;

            // Call MUWE provider for OXXO
            const MUWEProvider = require('./providers/muwe-provider');
            const muwe = new MUWEProvider();

            const transactionId = `VIAONE_${req.store.store_id}_${Date.now()}`;

            const muweResult = await muwe.oxxoPayment({
                amount: amount,
                reference: transactionId
            });

            const status = muweResult.success ? 'SUCCESS' : 'FAILED';

            // Save transaction
            await client.query(`
                INSERT INTO store_transactions
                (transaction_id, store_id, product_type, amount, retail_fee, cost, profit, status, provider, provider_transaction_id, provider_response, barcode_url, payment_url)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            `, [
                transactionId,
                req.store.store_id,
                'oxxo_gift_card',
                amount,
                retailFee,
                cost,
                profit,
                status,
                'MUWE',
                muweResult.providerTransactionId,
                JSON.stringify(muweResult),
                muweResult.barcodeUrl,
                muweResult.paymentUrl
            ]);

            await client.query('COMMIT');

            if (muweResult.success) {
                res.json({
                    success: true,
                    transaction_id: transactionId,
                    profit: profit,
                    barcodeUrl: muweResult.barcodeUrl,
                    paymentUrl: muweResult.paymentUrl,
                    message: 'OXXO voucher generated'
                });
            } else {
                res.status(500).json({
                    success: false,
                    error: muweResult.message || 'Voucher generation failed'
                });
            }

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('OXXO voucher error:', error);
            res.status(500).json({ success: false, error: error.message });
        } finally {
            client.release();
        }
    });

    // ==========================================
    // OWNER OPERATIONS
    // ==========================================

    // Get all stores with today's stats
    app.get('/api/owner/stores', async (req, res) => {
        const ownerToken = req.headers['x-store-token'];

        try {
            jwt.verify(ownerToken, JWT_SECRET);

            const result = await pool.query(`
                SELECT
                    s.store_id,
                    s.store_name,
                    s.is_active,
                    COUNT(st.id) as today_transactions,
                    COALESCE(SUM(st.amount + st.retail_fee), 0) as today_revenue,
                    COALESCE(SUM(st.profit), 0) as today_profit
                FROM stores s
                LEFT JOIN store_transactions st ON s.store_id = st.store_id
                    AND st.created_at >= CURRENT_DATE
                    AND st.status = 'SUCCESS'
                GROUP BY s.store_id, s.store_name, s.is_active
                ORDER BY s.store_id
            `);

            res.json({
                success: true,
                stores: result.rows
            });

        } catch (error) {
            console.error('Get stores error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // Get pricing for all stores
    app.get('/api/owner/pricing', async (req, res) => {
        const ownerToken = req.headers['x-store-token'];

        try {
            jwt.verify(ownerToken, JWT_SECRET);

            const result = await pool.query(`
                SELECT * FROM store_pricing
                ORDER BY store_id, product_type
            `);

            res.json({
                success: true,
                pricing: result.rows
            });

        } catch (error) {
            console.error('Get pricing error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // Update pricing
    app.post('/api/owner/update-pricing', async (req, res) => {
        const ownerToken = req.headers['x-store-token'];
        const { store_id, product_type, retail_fee, cost_per_transaction } = req.body;

        try {
            jwt.verify(ownerToken, JWT_SECRET);

            await pool.query(`
                UPDATE store_pricing
                SET retail_fee = $1, cost_per_transaction = $2, updated_at = NOW()
                WHERE store_id = $3 AND product_type = $4
            `, [retail_fee, cost_per_transaction, store_id, product_type]);

            res.json({
                success: true,
                message: 'Pricing updated successfully'
            });

        } catch (error) {
            console.error('Update pricing error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // Get all transactions (owner view)
    app.get('/api/owner/transactions', async (req, res) => {
        const ownerToken = req.headers['x-store-token'];
        const { date_from, date_to, store_id } = req.query;

        try {
            jwt.verify(ownerToken, JWT_SECRET);

            let query = `
                SELECT st.*, s.store_name
                FROM store_transactions st
                LEFT JOIN stores s ON st.store_id = s.store_id
                WHERE 1=1
            `;

            const params = [];
            let paramCount = 1;

            if (date_from) {
                query += ` AND st.created_at >= $${paramCount}`;
                params.push(date_from);
                paramCount++;
            }

            if (date_to) {
                query += ` AND st.created_at <= $${paramCount}`;
                params.push(date_to);
                paramCount++;
            }

            if (store_id) {
                query += ` AND st.store_id = $${paramCount}`;
                params.push(store_id);
                paramCount++;
            }

            query += ` ORDER BY st.created_at DESC LIMIT 500`;

            const result = await pool.query(query, params);

            res.json({
                success: true,
                transactions: result.rows
            });

        } catch (error) {
            console.error('Get transactions error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    console.log('✅ Via.One API endpoints registered');
};
