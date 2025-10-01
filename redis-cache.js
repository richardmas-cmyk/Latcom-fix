const Redis = require('ioredis');

class RedisCache {
    constructor() {
        this.client = null;
        this.connected = false;

        const redisUrl = process.env.REDIS_URL;

        if (!redisUrl) {
            console.log('⚠️  No REDIS_URL configured - running without cache');
            return;
        }

        try {
            this.client = new Redis(redisUrl, {
                maxRetriesPerRequest: 3,
                enableReadyCheck: true,
                retryStrategy(times) {
                    const delay = Math.min(times * 50, 2000);
                    return delay;
                }
            });

            this.client.on('connect', () => {
                console.log('✅ Redis connected');
                this.connected = true;
            });

            this.client.on('error', (err) => {
                console.log('❌ Redis error:', err.message);
                this.connected = false;
            });

        } catch (error) {
            console.log('❌ Redis initialization error:', error.message);
        }
    }

    /**
     * Get customer balance from cache
     */
    async getBalance(customerId) {
        if (!this.connected || !this.client) return null;

        try {
            const cached = await this.client.get(`balance:${customerId}`);
            if (cached) {
                return JSON.parse(cached);
            }
            return null;
        } catch (error) {
            console.error('Redis get error:', error.message);
            return null;
        }
    }

    /**
     * Set customer balance in cache (TTL: 30 seconds)
     */
    async setBalance(customerId, balanceData) {
        if (!this.connected || !this.client) return;

        try {
            await this.client.setex(
                `balance:${customerId}`,
                30, // 30 seconds TTL
                JSON.stringify(balanceData)
            );
        } catch (error) {
            console.error('Redis set error:', error.message);
        }
    }

    /**
     * Invalidate customer balance cache
     */
    async invalidateBalance(customerId) {
        if (!this.connected || !this.client) return;

        try {
            await this.client.del(`balance:${customerId}`);
        } catch (error) {
            console.error('Redis delete error:', error.message);
        }
    }

    /**
     * Get transaction from cache
     */
    async getTransaction(transactionId) {
        if (!this.connected || !this.client) return null;

        try {
            const cached = await this.client.get(`tx:${transactionId}`);
            if (cached) {
                return JSON.parse(cached);
            }
            return null;
        } catch (error) {
            console.error('Redis get error:', error.message);
            return null;
        }
    }

    /**
     * Cache transaction status (TTL: 60 seconds)
     */
    async setTransaction(transactionId, txData) {
        if (!this.connected || !this.client) return;

        try {
            await this.client.setex(
                `tx:${transactionId}`,
                60,
                JSON.stringify(txData)
            );
        } catch (error) {
            console.error('Redis set error:', error.message);
        }
    }

    /**
     * Check if Redis is available
     */
    isAvailable() {
        return this.connected && this.client !== null;
    }
}

module.exports = new RedisCache();
