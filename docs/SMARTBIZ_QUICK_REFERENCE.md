# SmartBiz Telecom API - Quick Reference Card
## Mobile Topups via Relier Group

## 🔐 Credentials

```
Customer ID: SMARTBIZ_001
Company: SmartBiz Telecom
API Key: smartbiz_prod_7d086ce74101615476169835689efbcd
Secret Key: SBT_545970e108537acd351c88ef1d8f572e52c6422058204102
Base URL: https://latcom-fix-production.up.railway.app
Provider: Relier Group
```

---

## 🚀 Quick Commands

### Check Balance
```bash
curl https://latcom-fix-production.up.railway.app/api/balance \
  -H "x-api-key: smartbiz_prod_7d086ce74101615476169835689efbcd" \
  -H "x-customer-id: SMARTBIZ_001"
```

### Topup (20 MXN)
```bash
curl -X POST https://latcom-fix-production.up.railway.app/api/enviadespensa/topup \
  -H "Content-Type: application/json" \
  -H "x-api-key: smartbiz_prod_7d086ce74101615476169835689efbcd" \
  -H "x-customer-id: SMARTBIZ_001" \
  -d '{
    "phone": "5512345678",
    "amount": 20,
    "reference": "TEST-001"
  }'
```

### Check Transaction Status
```bash
curl https://latcom-fix-production.up.railway.app/api/transaction/RLR1234567890 \
  -H "x-api-key: smartbiz_prod_7d086ce74101615476169835689efbcd" \
  -H "x-customer-id: SMARTBIZ_001"
```

---

## 📊 Account Info

| Item | Value |
|------|-------|
| **Credit Limit** | $200 USD (Testing) |
| **Starting Balance** | $200 USD |
| **Commission** | 0% |
| **Daily Limit (per user)** | 200,000 MXN (~$10K USD) |
| **Rate Limit** | 200 req/min |
| **Min Amount** | 10 MXN |
| **Max Amount** | 500 MXN |
| **Processing Time** | 2-10 seconds |

**Note:** Testing account - production balance will support $300K USD monthly volume.

---

## 🎯 Supported Carriers

| Carrier | Coverage |
|---------|----------|
| **Telcel** | Nationwide ✅ |
| **Movistar** | Nationwide ✅ |
| **AT&T Mexico** | Select regions ✅ |
| **Unefon** | Nationwide ✅ |
| **Virgin Mobile** | Available ✅ |

**Automatic Routing:** Enabled ✅
**Failover Protection:** Enabled ✅

---

## 🌐 Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/health` | System status |
| GET | `/api/balance` | Check balance |
| POST | `/api/enviadespensa/topup` | Topup (sync) |
| POST | `/api/enviadespensa/topup-async` | Topup (async) |
| GET | `/api/transaction/{id}` | Check status |
| GET | `/dashboard` | Web dashboard |
| GET | `/reconcile` | Reconciliation |

---

## 💰 Pricing

- **Balance Currency:** USD
- **Transaction Currency:** MXN
- **Exchange Rate:** Real-time (updated every 6 hours)
- **Example:** 50 MXN ≈ $2.94 USD (at rate 17.00)
- **Commission:** 0% (can be adjusted)

---

## 🚨 Response Codes

| Code | Meaning |
|------|---------|
| 200 | Success ✅ |
| 400 | Invalid request |
| 401 | Bad credentials |
| 403 | Insufficient balance |
| 429 | Rate limit exceeded |
| 500 | Processing error |

---

## 📱 Test Numbers

| Number | Result |
|--------|--------|
| `5500000000` | Always succeeds (test mode) |
| `5500000001` | Always fails (error testing) |
| `5512345678` | Real test (charges account) |

---

## 🔗 Important Links

- **API Docs:** `SMARTBIZ_API_INTEGRATION.md`
- **Dashboard:** https://latcom-fix-production.up.railway.app/dashboard
- **Reconcile:** https://latcom-fix-production.up.railway.app/reconcile
- **Health Check:** https://latcom-fix-production.up.railway.app/health
- **Support:** richardmas@gmail.com (Relier Group)

---

## 📦 Installation (Node.js)

```bash
npm install axios
```

```javascript
const axios = require('axios');

const RELIER_API = {
  baseURL: 'https://latcom-fix-production.up.railway.app',
  apiKey: 'smartbiz_prod_7d086ce74101615476169835689efbcd',
  customerId: 'SMARTBIZ_001'
};

async function topup(phone, amount) {
  const response = await axios.post(
    `${RELIER_API.baseURL}/api/enviadespensa/topup`,
    { phone, amount, reference: `ORDER-${Date.now()}` },
    {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': RELIER_API.apiKey,
        'x-customer-id': RELIER_API.customerId
      }
    }
  );
  return response.data;
}

// Usage
topup('5512345678', 20).then(result => {
  if (result.success) {
    console.log('✅ Topup successful!');
    console.log('Transaction ID:', result.transaction.id);
    console.log('Cost:', result.transaction.amount_usd, 'USD');
  } else {
    console.log('❌ Failed:', result.error);
  }
});
```

---

## ⚡ Quick Integration

### 1. Save credentials to .env
```bash
RELIER_API_KEY=smartbiz_prod_7d086ce74101615476169835689efbcd
RELIER_CUSTOMER_ID=SMARTBIZ_001
RELIER_BASE_URL=https://latcom-fix-production.up.railway.app
```

### 2. Test connection
```bash
curl https://latcom-fix-production.up.railway.app/health
```

### 3. Check balance
```bash
curl $RELIER_BASE_URL/api/balance \
  -H "x-api-key: $RELIER_API_KEY" \
  -H "x-customer-id: $RELIER_CUSTOMER_ID"
```

### 4. Start processing topups!

---

**Full Documentation:** See `SMARTBIZ_API_INTEGRATION.md`

**Support:** richardmas@gmail.com | Relier Group

**Version:** 2.0 (October 2025)
