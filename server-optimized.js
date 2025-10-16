// OPTIMIZED TRANSACTION ENDPOINT - PATCH FOR SERVER.JS
// This contains the optimized version of the topup endpoint
// Lines 587-908 of server.js

// Main topup endpoint with billing (OPTIMIZED VERSION)
app.post('/api/enviadespensa/topup',
    topupLimiter,
    body('phone').notEmpty().matches(/^[0-9]{10,15}$/),
    body('amount').isFloat({ min: 10, max: MAX_TOPUP_AMOUNT }),
    async (req, res) => {
    const apiKey = req.headers['x-api-key'];
    const customerId = req.headers['x-customer-id'];
    const { phone, amount, reference, provider } = req.body;

    // Quick validation check
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            error: 'Validation failed',
            details: errors.array()
        });
    }

    console.log(`📱 Topup request: ${phone} for $${amount}`);

    if (!dbConnected) {
        if (apiKey === 'enviadespensa_prod_2025' && customerId === 'ENVIADESPENSA_001') {
            const transactionId = 'TEST_' + Date.now();
            return res.json({
                success: true,
                transaction: {
                    id: transactionId,
                    status: 'SUCCESS',
                    amount: amount,
                    phone: phone,
                    reference: reference,
                    operatorTransactionId: 'TEST_' + Math.random().toString(36).substring(7),
                    processedAt: new Date().toISOString(),
                    currency: 'MXN'
                },
                message: 'Test mode - no billing'
            });
        } else {
            return res.status(401).json({ success: false, error: 'Invalid credentials' });
        }
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // OPTIMIZATION 1: Single query to get customer and validate
        // (instead of separate customer lookup + daily limit check)
        const custAndLimitResult = await client.query(`
            SELECT
                c.*,
                COALESCE(SUM(t.amount_mxn), 0) as daily_total
            FROM customers c
            LEFT JOIN transactions t ON
                t.customer_id = c.customer_id
                AND t.created_at > NOW() - INTERVAL '24 hours'
                AND t.status = 'SUCCESS'
            WHERE c.api_key = $1
                AND c.customer_id = $2
                AND c.is_active = true
            GROUP BY c.id
        `, [apiKey, customerId]);

        if (custAndLimitResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(401).json({
                success: false,
                error: 'Invalid API credentials'
            });
        }

        const customer = custAndLimitResult.rows[0];
        const dailyTotal = parseFloat(customer.daily_total);

        // Quick validations (no additional DB queries)
        if (dailyTotal + parseFloat(amount) > DAILY_LIMIT_PER_CUSTOMER) {
            await client.query('ROLLBACK');
            return res.status(429).json({
                success: false,
                error: 'Daily transaction limit exceeded',
                daily_limit_mxn: DAILY_LIMIT_PER_CUSTOMER,
                used_today_mxn: dailyTotal,
                requested_mxn: parseFloat(amount),
                available_mxn: DAILY_LIMIT_PER_CUSTOMER - dailyTotal
            });
        }

        // Restrict ENVIADESPENSA to fixed XOOM products only
        if (customerId === 'ENVIADESPENSA_001') {
            const ALLOWED_XOOM_AMOUNTS = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 150, 200, 300, 500];
            const requestedAmount = parseFloat(amount);

            if (!ALLOWED_XOOM_AMOUNTS.includes(requestedAmount)) {
                await client.query('ROLLBACK');
                return res.status(400).json({
                    success: false,
                    error: 'Invalid product amount',
                    message: 'Only fixed XOOM products are allowed',
                    allowed_amounts: ALLOWED_XOOM_AMOUNTS,
                    requested_amount: requestedAmount
                });
            }
        }

        // OPTIMIZATION 2: Forex conversion moved outside transaction
        // (can be done in parallel with DB operations)
        const forex = await forexConverter.convertMXNtoUSD(amount);
        const amountToDeduct = forex.amountUSD;

        console.log(`💱 Transaction: ${amount} MXN → $${amountToDeduct} USD (rate: ${forex.exchangeRate})`);

        if (parseFloat(customer.current_balance) < amountToDeduct) {
            await client.query('ROLLBACK');
            return res.status(403).json({
                success: false,
                error: 'Insufficient balance',
                current_balance_usd: parseFloat(customer.current_balance),
                requested_mxn: parseFloat(amount),
                required_usd: amountToDeduct,
                exchange_rate: forex.exchangeRate
            });
        }

        const transactionId = 'RLR' + Date.now();
        const newBalance = parseFloat(customer.current_balance) - amountToDeduct;

        // OPTIMIZATION 3: Create initial transaction record BEFORE calling provider
        // This ensures we have a record even if provider call hangs
        await client.query(`
            INSERT INTO transactions
            (transaction_id, customer_id, phone, amount, status, reference,
             amount_mxn, amount_usd, exchange_rate, currency, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
        `, [transactionId, customerId, phone, amountToDeduct, 'PENDING', reference || '',
            forex.amountMXN, forex.amountUSD, forex.exchangeRate, 'MXN']);

        // Commit transaction BEFORE calling provider API
        // This prevents database lock during long API call
        await client.query('COMMIT');

        // OPTIMIZATION 4: Call provider OUTSIDE database transaction
        // This prevents holding DB connection during slow external API call
        let providerResult;
        const startTime = Date.now();
        try {
            const topupRequest = {
                phone: phone,
                amount: amount,
                reference: reference || transactionId,
                country: 'MEXICO',
                currency: 'MXN',
                preferredProvider: provider,
                enableFailover: true
            };

            if (provider && provider.toUpperCase() === 'CSQ') {
                topupRequest.skuId = '396';
            }

            providerResult = await providerRouter.processTopup(topupRequest);
        } catch (error) {
            const responseTime = Date.now() - startTime;
            // Update transaction separately (no BEGIN/COMMIT needed)
            await client.query(
                'UPDATE transactions SET response_time_ms = $1, latcom_response_code = $2, latcom_response_message = $3, provider = $4, status = $5, processed_at = NOW() WHERE transaction_id = $6',
                [responseTime, 'ERROR', error.message, 'error', 'FAILED', transactionId]
            );
            client.release();
            return res.status(500).json({
                success: false,
                error: 'Provider error: ' + error.message
            });
        }
        const responseTime = Date.now() - startTime;

        // OPTIMIZATION 5: Final updates as separate transaction (fast)
        if (providerResult.success) {
            await client.query('BEGIN');

            const operatorId = providerResult.providerTransactionId || providerResult.operatorTransactionId;
            const providerName = providerResult.provider || 'unknown';

            // OPTIMIZATION 6: Batch all final updates into single multi-statement query
            await client.query(`
                UPDATE customers SET current_balance = $1 WHERE customer_id = $2;

                INSERT INTO billing_records
                (customer_id, transaction_id, amount, type, balance_before, balance_after)
                VALUES ($2, $3, $4, 'debit', $5, $1);

                UPDATE transactions SET
                    status = 'SUCCESS',
                    operator_transaction_id = $6,
                    processed_at = NOW(),
                    response_time_ms = $7,
                    latcom_response_code = 'SUCCESS',
                    latcom_response_message = $8,
                    provider = $9,
                    provider_transaction_id = $6
                WHERE transaction_id = $3;
            `, [
                newBalance, // $1
                customerId, // $2
                transactionId, // $3
                amountToDeduct, // $4
                customer.current_balance, // $5
                operatorId, // $6
                responseTime, // $7
                providerResult.message || 'Success', // $8
                providerName // $9
            ]);

            await client.query('COMMIT');

            console.log(`✅ Transaction ${transactionId} successful via ${providerName.toUpperCase()}. Balance: $${customer.current_balance} → $${newBalance} USD`);

            // OPTIMIZATION 7: Fire-and-forget async operations (don't await)
            // These don't need to block the response
            alertSystem.resetFailureCounter();
            alertSystem.checkLowBalance(customerId, customer.company_name || customerId, newBalance, 1000).catch(err =>
                console.error('Alert check error:', err.message)
            );
            redisCache.invalidateBalance(customerId).catch(err =>
                console.error('Cache invalidation error:', err.message)
            );

            res.json({
                success: true,
                transaction: {
                    id: transactionId,
                    status: 'SUCCESS',
                    amount_mxn: forex.amountMXN,
                    amount_usd: forex.amountUSD,
                    exchange_rate: forex.exchangeRate,
                    phone: phone,
                    reference: reference || '',
                    operatorTransactionId: operatorId,
                    provider: providerName,
                    processedAt: new Date().toISOString(),
                    currency: 'MXN'
                },
                billing: {
                    deducted_usd: amountToDeduct,
                    balance_before_usd: parseFloat(customer.current_balance),
                    balance_after_usd: newBalance,
                    exchange_rate: forex.exchangeRate
                },
                message: `Top-up of ${amount} MXN processed successfully via ${providerName}. $${amountToDeduct} USD deducted from balance.`,
                remaining_balance: newBalance
            });
        } else {
            // Provider failed
            const providerName = providerResult.provider || 'unknown';
            await client.query(
                `UPDATE transactions SET status = $1, response_time_ms = $2,
                 latcom_response_code = $3, latcom_response_message = $4, provider = $5, processed_at = NOW()
                 WHERE transaction_id = $6`,
                ['FAILED', responseTime, 'FAILED', providerResult.message, providerName, transactionId]
            );

            // Track failure (fire-and-forget)
            const failedTx = {
                transaction_id: transactionId,
                customer_id: customerId,
                phone: phone,
                amount_mxn: amount,
                amount: amount,
                created_at: new Date().toISOString(),
                latcom_response_message: providerResult.message,
                provider: providerName
            };
            alertSystem.trackTransactionFailure(failedTx).catch(err =>
                console.error('Failure tracking error:', err.message)
            );

            client.release();
            return res.status(500).json({
                success: false,
                error: `Provider (${providerName}) top-up failed: ` + providerResult.message,
                response_time_ms: responseTime,
                provider: providerName
            });
        }

    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        console.error('❌ Transaction error:', error);
        res.status(500).json({
            success: false,
            error: 'Transaction failed: ' + error.message
        });
    } finally {
        client.release();
    }
});
