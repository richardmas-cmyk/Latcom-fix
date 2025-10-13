# Test Environment Setup Guide

## Overview

The Relier Hub platform now has **separate test and production environments** to enable safe testing without spending real money or affecting production customers.

---

## Environments

### 1. **Production Environment** (Current)
- **Railway Service:** Latcom-fix (production)
- **Database:** Production PostgreSQL
- **URL:** https://latcom-fix-production.up.railway.app
- **Purpose:** Real customer transactions only
- **Providers:** Real CSQ, PPN, XOOM, MUWE APIs
- **Money:** Real transactions that cost real money

### 2. **Staging/Test Environment** (New)
- **Railway Service:** staging environment
- **Database:** Test PostgreSQL database
- **URL:** TBD (after deployment)
- **Purpose:** Testing new features, debugging, development
- **Providers:** Mock provider (no real API calls)
- **Money:** No real money spent - all transactions are simulated

---

## How Test Mode Works

When `TEST_MODE=true` or `NODE_ENV=staging`:

1. **Mock Provider Activated**
   - All topup requests go to mock provider
   - No real API calls to CSQ/PPN/MUWE/XOOM
   - Instant responses (500ms simulated delay)
   - Always returns success

2. **Test Indicators**
   - All responses include `"testMode": true`
   - Transaction IDs prefixed with `MOCK_`
   - Console shows `🧪 TEST MODE` messages

3. **Unlimited Balance**
   - Mock balance check returns `$99,999.99`
   - No actual money deducted

---

## Configuration Files

### `.env.staging` (Test Environment)
```bash
# STAGING ENVIRONMENT - FOR TESTING ONLY
NODE_ENV=staging
PORT=3000

# Database (Staging)
DATABASE_URL=postgresql://user:pass@host:5432/latcom_staging

# Test Mode Flag
TEST_MODE=true
MOCK_PROVIDERS=true

# Test Customer Credentials
ENVIADESPENSA_TEST_KEY=enviadespensa_test_2025
ENVIADESPENSA_TEST_ID=ENVIADESPENSA_TEST

# CSQ (Test/Sandbox - if available)
CSQ_BASE_URL=https://evsbus.csqworld.com
CSQ_USERNAME=host.180167
CSQ_PASSWORD=z5r3rr3s96
CSQ_TERMINAL_ID=180167
CSQ_DEFAULT_OPERATOR_ID=1

# Admin Keys
ADMIN_KEY=relier_admin_staging_2025
RECONCILE_KEY=relier_reconcile_staging_2025

# Alert System (Disabled in staging)
ENABLE_ALERTS=false

# Mode
LATCOM_MODE=XOOM_ONLY
```

### Production `.env` (Keep as is)
- No `TEST_MODE` variable
- `NODE_ENV=production`
- Real provider credentials
- Real database

---

## Testing in Staging

### Example Test Request
```bash
curl -X POST "https://staging-url.railway.app/api/enviadespensa/topup" \
  -H "Content-Type: application/json" \
  -H "x-api-key: enviadespensa_test_2025" \
  -H "x-customer-id: ENVIADESPENSA_TEST" \
  -d '{
    "phone": "5555777845",
    "amount": 20,
    "provider": "CSQ"
  }'
```

### Expected Response (Test Mode)
```json
{
  "success": true,
  "transaction_id": "RLR1760123456789",
  "provider": "MOCK",
  "provider_transaction_id": "MOCK_1760123456789",
  "message": "Mock transaction successful (TEST MODE)",
  "response_time_ms": 500,
  "testMode": true
}
```

**Key Indicator:** `"testMode": true` tells you this was a simulated transaction.

---

## Deployment Steps

### Deploy Staging Environment to Railway

1. **Switch to staging environment:**
```bash
railway environment staging
```

2. **Set environment variables:**
```bash
railway variables set TEST_MODE=true
railway variables set NODE_ENV=staging
railway variables set ADMIN_KEY=relier_admin_staging_2025
# ... set all variables from .env.staging
```

3. **Create staging database:**
```bash
railway add postgresql
```

4. **Deploy:**
```bash
railway up
```

5. **Get staging URL:**
```bash
railway domain
```

---

## When to Use Each Environment

### Use **Staging/Test** For:
- ✅ Testing new CSQ SKU IDs
- ✅ Testing new AT&T products
- ✅ Debugging API integration issues
- ✅ Testing new features before production
- ✅ Development and experimentation
- ✅ Customer UAT testing (with mock data)

### Use **Production** For:
- ✅ Real customer transactions only
- ✅ Live EnviaDespensa API calls
- ✅ Actual money transfers

---

## Safety Features

### Staging Protections
1. Mock provider never calls real APIs
2. Separate database (can't corrupt production data)
3. Different API keys (customers can't accidentally use staging)
4. Alerts disabled (no spam during testing)

### Production Protections
1. No `TEST_MODE` variable set
2. Only real customer API keys work
3. Real provider credentials
4. Alerts enabled for issues

---

## Mock Provider Capabilities

The mock provider simulates all provider features:

- **Topups:** Always succeed after 500ms
- **Bill Payments:** Simulated
- **Vouchers:** Returns mock PINs
- **Balance Check:** Returns $99,999.99
- **Phone Lookup:** Returns mock operator data
- **Products:** Returns mock product catalog

---

## Railway Environment Management

### Switch Between Environments
```bash
# Switch to production
railway environment production

# Switch to staging
railway environment staging

# Check current environment
railway status
```

### View Variables
```bash
# In current environment
railway variables

# Specific environment
railway environment staging
railway variables
```

---

## Benefits

1. **No Real Money Wasted**
   - Test CSQ products without spending $1.09 each time
   - Test AT&T products without worrying about costs

2. **Safe Experimentation**
   - Try new SKU IDs without fear
   - Debug issues without affecting customers

3. **Faster Testing**
   - Mock responses in 500ms vs 8+ seconds
   - No waiting for real provider APIs

4. **Data Safety**
   - Separate database prevents production corruption
   - Can reset test data anytime

5. **Clear Separation**
   - Know immediately if you're in test vs production
   - Different URLs, keys, databases

---

## Next Steps

1. ✅ Created staging environment
2. ✅ Added mock provider code
3. ✅ Created configuration files
4. ⏳ Deploy staging to Railway
5. ⏳ Test staging deployment
6. ⏳ Document staging URL

---

## Questions?

- **"How do I know if I'm in test mode?"**
  - Check for `"testMode": true` in API responses
  - Console shows `🧪 TEST MODE` messages

- **"Can I use real CSQ in staging?"**
  - Yes, remove `TEST_MODE=true` from staging variables
  - But you'll spend real money

- **"What if I accidentally use production instead of staging?"**
  - Production doesn't have `TEST_MODE` set
  - Real transactions will execute and cost money
  - Always double-check the URL and environment

---

## File Changes Made

1. **providers/mock-provider.js** - New mock provider
2. **providers/provider-router.js** - Added test mode detection
3. **.env.staging** - Staging environment configuration
4. **TEST_ENVIRONMENT_GUIDE.md** - This guide

---

Created: October 11, 2025
