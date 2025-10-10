const Queue = require('bull');
const latcomAPI = require('./latcom-api');
const { createPool } = require('./database-config');

class QueueProcessor {
    constructor() {
        this.topupQueue = null;
        this.pool = null;
        this.initialized = false;

        const redisUrl = process.env.REDIS_URL;

        if (!redisUrl) {
            console.log('⚠️  No REDIS_URL - Queue system disabled');
            return;
        }

        try {
            // Create Bull queue with Redis
            this.topupQueue = new Queue('topup-processing', redisUrl, {
                defaultJobOptions: {
                    attempts: 3,
                    backoff: {
                        type: 'exponential',
                        delay: 2000
                    },
                    removeOnComplete: 100, // Keep last 100 completed
                    removeOnFail: 200      // Keep last 200 failed
                }
            });

            // Initialize database pool
            this.pool = createPool();

            // Set up queue processor with high concurrency for Phase 2
            const concurrency = parseInt(process.env.QUEUE_CONCURRENCY || '20');
            this.topupQueue.process(concurrency, async (job) => {
                return await this.processTopup(job.data);
            });

            // Queue event handlers
            this.topupQueue.on('completed', (job, result) => {
                console.log(`✅ Job ${job.id} completed:`, result.transactionId);
            });

            this.topupQueue.on('failed', (job, err) => {
                console.log(`❌ Job ${job.id} failed:`, err.message);
            });

            this.topupQueue.on('stalled', (job) => {
                console.log(`⚠️  Job ${job.id} stalled`);
            });

            this.initialized = true;
            console.log(`✅ Queue processor initialized - processing ${concurrency} concurrent jobs`);

        } catch (error) {
            console.log('❌ Queue initialization error:', error.message);
        }
    }

    /**
     * Process a single topup job
     */
    async processTopup(jobData) {
        const { customerId, phone, amount, reference, transactionId } = jobData;

        if (!this.pool) {
            throw new Error('Database not available');
        }

        const client = await this.pool.connect();

        try {
            await client.query('BEGIN');

            // Verify customer
            const custResult = await client.query(
                'SELECT * FROM customers WHERE customer_id = $1 AND is_active = true',
                [customerId]
            );

            if (custResult.rows.length === 0) {
                throw new Error('Invalid customer');
            }

            const customer = custResult.rows[0];

            // Check balance
            if (parseFloat(customer.current_balance) < parseFloat(amount)) {
                throw new Error('Insufficient balance');
            }

            const newBalance = parseFloat(customer.current_balance) - parseFloat(amount);

            // Update transaction to processing
            await client.query(
                'UPDATE transactions SET status = $1 WHERE transaction_id = $2',
                ['PROCESSING', transactionId]
            );

            // Call Latcom API
            let latcomResult;
            try {
                latcomResult = await latcomAPI.topup(phone, amount, reference);
            } catch (error) {
                await client.query('ROLLBACK');
                throw new Error('Latcom API error: ' + error.message);
            }

            if (latcomResult.success) {
                const operatorId = latcomResult.operatorTransactionId;

                // Update customer balance
                await client.query(
                    'UPDATE customers SET current_balance = $1 WHERE customer_id = $2',
                    [newBalance, customerId]
                );

                // Create billing record
                await client.query(`
                    INSERT INTO billing_records
                    (customer_id, transaction_id, amount, type, balance_before, balance_after)
                    VALUES ($1, $2, $3, $4, $5, $6)
                `, [
                    customerId,
                    transactionId,
                    amount,
                    'debit',
                    customer.current_balance,
                    newBalance
                ]);

                // Update transaction status
                await client.query(
                    'UPDATE transactions SET status = $1, operator_transaction_id = $2, processed_at = NOW() WHERE transaction_id = $3',
                    ['SUCCESS', operatorId, transactionId]
                );

                await client.query('COMMIT');

                console.log(`✅ Transaction ${transactionId} successful. Balance: ${customer.current_balance} → ${newBalance}`);

                return {
                    success: true,
                    transactionId,
                    operatorTransactionId: operatorId,
                    newBalance
                };

            } else {
                // Latcom failed - rollback
                await client.query(
                    'UPDATE transactions SET status = $1 WHERE transaction_id = $2',
                    ['FAILED', transactionId]
                );
                await client.query('ROLLBACK');

                throw new Error('Latcom top-up failed: ' + latcomResult.message);
            }

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Add topup job to queue
     */
    async addTopupJob(jobData) {
        if (!this.initialized || !this.topupQueue) {
            throw new Error('Queue not initialized');
        }

        const job = await this.topupQueue.add(jobData, {
            priority: 1,
            jobId: jobData.transactionId
        });

        return job;
    }

    /**
     * Get job status
     */
    async getJobStatus(transactionId) {
        if (!this.initialized || !this.topupQueue) {
            return null;
        }

        const job = await this.topupQueue.getJob(transactionId);

        if (!job) return null;

        const state = await job.getState();
        const progress = job.progress();

        return {
            id: job.id,
            state,
            progress,
            data: job.data,
            returnvalue: job.returnvalue,
            failedReason: job.failedReason,
            attemptsMade: job.attemptsMade
        };
    }

    /**
     * Get queue stats
     */
    async getQueueStats() {
        if (!this.initialized || !this.topupQueue) {
            return null;
        }

        const [waiting, active, completed, failed, delayed] = await Promise.all([
            this.topupQueue.getWaitingCount(),
            this.topupQueue.getActiveCount(),
            this.topupQueue.getCompletedCount(),
            this.topupQueue.getFailedCount(),
            this.topupQueue.getDelayedCount()
        ]);

        return {
            waiting,
            active,
            completed,
            failed,
            delayed,
            total: waiting + active + completed + failed + delayed
        };
    }

    /**
     * Check if queue is available
     */
    isAvailable() {
        return this.initialized && this.topupQueue !== null;
    }
}

module.exports = new QueueProcessor();
