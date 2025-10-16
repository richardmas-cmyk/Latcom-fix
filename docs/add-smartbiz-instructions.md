# How to Add SmartBiz Telecom to Your Database

Since your database is on Railway, here are 3 ways to add the customer:

## Option 1: Railway CLI (Easiest)

If you have Railway CLI installed:

```bash
# From the latcom-fix directory
railway run node add-smartbiz-to-railway.js
```

## Option 2: Direct SQL via Railway

```bash
# Connect to Railway database
railway run psql $DATABASE_URL

# Then run this SQL:
INSERT INTO customers (
    customer_id, company_name, api_key, secret_key,
    credit_limit, current_balance, commission_percentage, is_active
) VALUES (
    'SMARTBIZ_001',
    'SmartBiz Telecom',
    'smartbiz_prod_7d086ce74101615476169835689efbcd',
    'SBT_545970e108537acd351c88ef1d8f572e52c6422058204102',
    50000, 50000, 0.00, true
);

# Verify:
SELECT customer_id, company_name, current_balance FROM customers WHERE customer_id = 'SMARTBIZ_001';

# Exit:
\q
```

## Option 3: Use the SQL file

```bash
railway run psql $DATABASE_URL -f add-smartbiz-customer.sql
```

## Verify It Worked

Test the API with the new credentials:

```bash
# Check balance
curl https://latcom-fix-production.up.railway.app/api/balance \
  -H "x-api-key: smartbiz_prod_7d086ce74101615476169835689efbcd" \
  -H "x-customer-id: SMARTBIZ_001"

# Should return:
# {
#   "success": true,
#   "customer_id": "SMARTBIZ_001",
#   "company_name": "SmartBiz Telecom",
#   "current_balance": 50000,
#   "credit_limit": 50000,
#   "currency": "USD"
# }
```

## If Railway CLI is not installed:

Install it first:

```bash
# macOS
brew install railway

# Or npm
npm install -g @railway/cli

# Login
railway login

# Link to your project
railway link
```

Then use Option 1 above.
