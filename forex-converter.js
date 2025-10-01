const axios = require('axios');

class ForexConverter {
    constructor() {
        this.cache = {
            rate: null,
            timestamp: null,
            ttl: 3600000 // 1 hour cache
        };
    }

    // Get MXN to USD exchange rate
    async getMXNtoUSD() {
        // Check cache first
        if (this.cache.rate && this.cache.timestamp) {
            const age = Date.now() - this.cache.timestamp;
            if (age < this.cache.ttl) {
                console.log(`💱 Using cached forex rate: 1 MXN = $${this.cache.rate} USD (${Math.round(age/1000/60)} mins old)`);
                return this.cache.rate;
            }
        }

        try {
            // Use free forex API (exchangerate-api.com)
            const response = await axios.get('https://api.exchangerate-api.com/v4/latest/MXN');
            const rate = response.data.rates.USD;

            // Cache the rate
            this.cache.rate = rate;
            this.cache.timestamp = Date.now();

            console.log(`💱 Fresh forex rate fetched: 1 MXN = $${rate} USD`);
            return rate;

        } catch (error) {
            console.error('❌ Forex API error:', error.message);

            // Fallback to cached rate if available
            if (this.cache.rate) {
                console.log(`⚠️  Using stale cached rate: 1 MXN = $${this.cache.rate} USD`);
                return this.cache.rate;
            }

            // Ultimate fallback (approximate rate)
            const fallbackRate = 0.050; // ~1 MXN = $0.05 USD (update this periodically)
            console.log(`⚠️  Using fallback rate: 1 MXN = $${fallbackRate} USD`);
            return fallbackRate;
        }
    }

    // Convert MXN to USD
    async convertMXNtoUSD(amountMXN) {
        const rate = await this.getMXNtoUSD();
        const amountUSD = amountMXN * rate;

        console.log(`💱 Conversion: ${amountMXN} MXN = $${amountUSD.toFixed(2)} USD (rate: ${rate})`);

        return {
            amountMXN: parseFloat(amountMXN),
            amountUSD: parseFloat(amountUSD.toFixed(2)),
            exchangeRate: rate,
            timestamp: new Date().toISOString()
        };
    }

    // Get current exchange rate info
    getRateInfo() {
        if (!this.cache.rate) {
            return { available: false };
        }

        const age = Date.now() - this.cache.timestamp;
        const ageMinutes = Math.round(age / 1000 / 60);

        return {
            available: true,
            rate: this.cache.rate,
            lastUpdated: new Date(this.cache.timestamp).toISOString(),
            ageMinutes: ageMinutes,
            isFresh: age < this.cache.ttl
        };
    }
}

module.exports = new ForexConverter();
