# HAZ Group - Customer Credentials & Setup Guide

**Date Created:** 2025-10-13
**Status:** ✅ Active - Ready for Testing

---

## 📋 Customer Information

- **Customer ID:** `HAZ_001`
- **Company Name:** HAZ Group
- **Status:** ACTIVE
- **Initial Balance:** $10,000 USD
- **Credit Limit:** $10,000 USD

---

## 🔑 API Credentials

```
API Key: haz_prod_2025
Customer ID: HAZ_001
Secret Key: HAZ!gr0up#2025$
```

⚠️ **IMPORTANT:** Keep these credentials secure. Do not commit to public repositories.

---

## 🌐 API Endpoints

**Base URL (Production):**
```
https://latcom-fix-production.up.railway.app
```

### Available Endpoints:

1. **Topup (Synchronous):**
   ```
   POST /api/enviadespensa/topup
   ```

2. **Topup (Asynchronous with Queue):**
   ```
   POST /api/enviadespensa/topup-async
   ```

3. **Check Balance:**
   ```
   GET /api/balance
   ```

4. **Transaction Status:**
   ```
   GET /api/transaction/{transactionId}
   ```

5. **Health Check:**
   ```
   GET /health
   ```

---

## 📝 Example API Request

### Basic Topup Request

```bash
curl -X POST https://latcom-fix-production.up.railway.app/api/enviadespensa/topup \
  -H "Content-Type: application/json" \
  -H "x-api-key: haz_prod_2025" \
  -H "x-customer-id: HAZ_001" \
  -d '{
    "phone": "5566374683",
    "amount": 20
  }'
```

### Successful Response:

```json
{
  "success": true,
  "transaction": {
    "id": "RLR1760353500123",
    "status": "SUCCESS",
    "amount_mxn": 20,
    "amount_usd": 1.08,
    "exchange_rate": 18.52,
    "phone": "5566374683",
    "operatorTransactionId": "LT62599623",
    "provider": "latcom",
    "processedAt": "2025-10-13T10:00:00Z",
    "currency": "MXN"
  },
  "billing": {
    "deducted_usd": 1.08,
    "balance_before_usd": 10000,
    "balance_after_usd": 9998.92,
    "exchange_rate": 18.52
  },
  "message": "Top-up of 20 MXN processed successfully via latcom. $1.08 USD deducted from balance.",
  "remaining_balance": 9998.92
}
```

---

## 💡 Available Products

**Latcom XOOM Products (Mexico):**

| Amount (MXN) | Typical USD Cost* |
|--------------|-------------------|
| 10           | ~$0.54           |
| 20           | ~$1.08           |
| 30           | ~$1.62           |
| 40           | ~$2.16           |
| 50           | ~$2.70           |
| 60           | ~$3.24           |
| 70           | ~$3.78           |
| 80           | ~$4.32           |
| 90           | ~$4.86           |
| 100          | ~$5.40           |
| 150          | ~$8.10           |
| 200          | ~$10.80          |
| 300          | ~$16.20          |
| 500          | ~$27.00          |

*USD costs are approximate and based on real-time exchange rates (≈18.5 MXN/USD)

**Operators Supported:**
- Telcel
- Movistar/Telefonica
- AT&T
- Unefon
- Virgin Mobile

---

## 🔒 Security Features

### 1. API Key Authentication
- All requests require `x-api-key` and `x-customer-id` headers
- Keys are validated against database

### 2. Rate Limiting
- **General API:** 300 requests per 15 minutes
- **Topup endpoint:** 200 requests per minute per customer
- Exceeding limits returns: `{"success":false,"error":"Too many requests"}`

### 3. Daily Transaction Limit
- **Maximum:** 5,000 MXN per customer per 24 hours
- Prevents excessive spending
- Resets automatically

### 4. IP Whitelisting (Optional)
- **Status:** Currently DISABLED for HAZ_001
- Can be enabled for added security if static IP available
- See `IP_WHITELISTING_GUIDE.md` for setup instructions

---

## 🔧 Testing Instructions

### Step 1: Check API Health

```bash
curl https://latcom-fix-production.up.railway.app/health
```

Expected response: `{"status":"OK",...}`

### Step 2: Check Your IP Address

```bash
curl https://latcom-fix-production.up.railway.app/api/check-ip
```

This shows the IP that will be seen by the API.

### Step 3: Check Balance

```bash
curl -X GET https://latcom-fix-production.up.railway.app/api/balance \
  -H "x-api-key: haz_prod_2025" \
  -H "x-customer-id: HAZ_001"
```

### Step 4: Test Small Topup (10 MXN)

```bash
curl -X POST https://latcom-fix-production.up.railway.app/api/enviadespensa/topup \
  -H "Content-Type: application/json" \
  -H "x-api-key: haz_prod_2025" \
  -H "x-customer-id: HAZ_001" \
  -d '{"phone":"5566374683","amount":10}'
```

### Step 5: Monitor Transaction

After getting a transaction ID from Step 4, check its status:

```bash
curl https://latcom-fix-production.up.railway.app/api/transaction/RLR1760353500123
```

---

## 📊 Monitoring & Dashboards

### Customer Dashboard
```
https://latcom-fix-production.up.railway.app/dashboard
```

Login with your API credentials to view:
- Transaction history
- Current balance
- Recent activity
- Success/failure rates

### Billing Information
- Balance is maintained in USD
- MXN amounts are converted at current exchange rate
- USD is deducted from balance
- Full forex details included in each transaction response

---

## ⚠️ Important Notes

### Transaction Processing
1. **Processing Time:** 2-7 seconds average
2. **Response Handling:** Always check `success` field in response
3. **Idempotency:** Use unique `reference` for each request to prevent duplicates
4. **Error Handling:** Implement retry logic with exponential backoff

### Balance Management
- Balance starts at $10,000 USD
- Topups deduct USD equivalent at current rate
- Low balance alerts configured at $1,000 USD
- Contact admin to add credit when needed

### Phone Number Format
- **Format:** 10 digits (Mexican format)
- **Example:** `5566374683` (NOT +52 or 52)
- **Validation:** System validates 10-15 digit numbers

### Product Selection
- Only fixed XOOM amounts are allowed
- Invalid amounts will be rejected
- See available products table above

---

## 🚨 Error Handling

### Common Errors:

**401 - Invalid API credentials**
```json
{"success":false,"error":"Invalid API credentials"}
```
→ Check `x-api-key` and `x-customer-id` headers

**403 - Insufficient balance**
```json
{"success":false,"error":"Insufficient balance","current_balance_usd":5.00}
```
→ Contact admin to add credit

**400 - Invalid product amount**
```json
{"success":false,"error":"Invalid product amount","allowed_amounts":[10,20,30,...]}
```
→ Use only allowed XOOM amounts

**429 - Rate limit exceeded**
```json
{"success":false,"error":"Too many topup requests. Maximum 200 per minute."}
```
→ Implement rate limiting on your side

**500 - Provider error**
```json
{"success":false,"error":"Provider (latcom) top-up failed: ..."}
```
→ Retry after a few seconds or contact support

---

## 📞 Support & Contact

### For Technical Issues:
- Check system health: `/health` endpoint
- Review transaction logs in dashboard
- Contact admin with transaction ID for investigation

### For Billing Issues:
- Check balance: `/api/balance` endpoint
- Request balance increase: Contact admin
- Review invoicing: Admin dashboard

### For Security Questions:
- IP whitelisting setup: See `IP_WHITELISTING_GUIDE.md`
- API key rotation: Contact admin
- Credential reset: Contact admin

---

## 📚 Additional Documentation

- **IP Whitelisting:** `IP_WHITELISTING_GUIDE.md`
- **Provider Details:** `PROVIDER_SUMMARY.md`
- **Project Context:** `PROJECT_CONTEXT.md`
- **API Integration:** See example code above

---

## ✅ Pre-Production Checklist

Before moving to production, HAZ Group should:

- [ ] Test all endpoints successfully
- [ ] Implement error handling and retries
- [ ] Set up monitoring for transaction status
- [ ] Configure IP whitelisting (if using static IP)
- [ ] Establish process for balance top-ups
- [ ] Set up webhook notifications (if needed)
- [ ] Review rate limiting impacts on volume
- [ ] Test fail over scenarios
- [ ] Document internal integration
- [ ] Train team on API usage

---

## 🎯 Next Steps for HAZ Group

1. **Test Phase:**
   - Run test transactions with small amounts
   - Verify all endpoints work correctly
   - Test error scenarios

2. **Integration:**
   - Integrate API into your systems
   - Implement proper error handling
   - Set up monitoring

3. **Security:**
   - Provide static IP(s) if whitelisting desired
   - Implement secure credential storage
   - Set up alerts for failed transactions

4. **Production:**
   - Start with low volume
   - Monitor performance
   - Scale up gradually

---

**Questions?** Contact admin for assistance.

**Last Updated:** 2025-10-13
**Document Version:** 1.0
