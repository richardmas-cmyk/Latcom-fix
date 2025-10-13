# Quick Reference - Relier Billing System

## 🚀 Dashboards

| Dashboard | URL | Purpose |
|-----------|-----|---------|
| Customer Dashboard | `/dashboard` | Real-time balance, transactions |
| Admin Panel | `/admin` | Manage credits, export CSV |
| Queue Monitor | `/queue` | Monitor job processing |

## 📡 API Endpoints

### Customer Endpoints

#### Sync Topup (Original)
```bash
POST /api/enviadespensa/topup
Headers:
  x-api-key: enviadespensa_prod_2025
  x-customer-id: ENVIADESPENSA_001
Body:
  {
    "phone": "5615622314",
    "amount": 20,
    "reference": "ORDER_123"
  }
```
- ⏱️ Response time: 6-7 seconds
- ✅ Returns final status
- 📊 Max: 10 txs/minute

#### Async Topup (NEW - High Volume)
```bash
POST /api/enviadespensa/topup-async
Headers: (same as above)
Body: (same as above)
```
- ⏱️ Response time: < 100ms
- ⏳ Returns PENDING status
- 📊 Max: 30+ txs/minute
- Check status: `GET /api/transaction/:id`

#### Balance Check
```bash
GET /api/balance
Headers:
  x-api-key: enviadespensa_prod_2025
  x-customer-id: ENVIADESPENSA_001
```
- 💨 Cached for 30 seconds
- ⚡ 10x faster than before

#### Transaction Status
```bash
GET /api/transaction/RLR1234567890
```
- Shows current transaction status
- Includes queue position if pending

### Admin Endpoints

#### Add/Subtract Credit
```bash
POST /api/admin/add-credit
Headers:
  x-admin-key: YOUR_ADMIN_KEY
Body:
  {
    "customer_id": "ENVIADESPENSA_001",
    "amount": 1000  (use negative to subtract)
  }
```

#### Get All Customers
```bash
GET /api/admin/customers
Headers:
  x-admin-key: YOUR_ADMIN_KEY
```

#### Get All Transactions
```bash
GET /api/admin/all-transactions
Headers:
  x-admin-key: YOUR_ADMIN_KEY
```

#### Queue Statistics
```bash
GET /api/queue/stats
```
- No auth required
- Shows queue health

## 🔧 Railway Variables

Required:
```
DATABASE_URL=postgres://...
DATABASE_PUBLIC_URL=postgres://...
LATCOM_DIST_API=https://lattest.mitopup.com
LATCOM_USERNAME=enviadespensa
LATCOM_PASSWORD=ENV!d32025#
LATCOM_USER_UID=20060916
LATCOM_API_KEY=38aa13413d1431fba1824f2633c2b7d67f5fffcb91b043629a0d1fe09df2fb8d
ADMIN_KEY=YourSecurePassword123!
REDIS_URL=redis://...  (ADD THIS FOR QUEUE)
```

## 📊 System Capacity

| Metric | Sync Only | With Queue | With 2 Instances |
|--------|-----------|------------|------------------|
| Txs/Minute | 10 | 30+ | 60+ |
| Txs/Hour | 600 | 1,800 | 3,600 |
| Daily Max | 14,000 | 40,000+ | 80,000+ |

## 🔍 Health Checks

### System Health
```bash
curl https://your-app.up.railway.app/health
```
Expected:
```json
{
  "status": "OK",
  "mode": "PRODUCTION",
  "database": "connected",
  "message": "API is running"
}
```

### Queue Health
```bash
curl https://your-app.up.railway.app/api/queue/stats
```
Expected:
```json
{
  "success": true,
  "queue": {
    "waiting": 0,
    "active": 2,
    "completed": 1500,
    "failed": 3
  },
  "redis": true
}
```

## ⚠️ Transaction Status Codes

| Status | Meaning |
|--------|---------|
| PENDING | Queued, not yet processed |
| PROCESSING | Currently calling Latcom |
| SUCCESS | Completed successfully |
| FAILED | Latcom rejected or error |

## 🎯 Product Configuration

Current Provider Product:
```
productId: TFE_MXN_20_TO_2000
operator: TELEFONICA
country: MEXICO
currency: MXN  (NOT USD!)
amount: 20-2000 (integers only)
```

## 💡 Tips

### For High Volume:
1. Use `/topup-async` endpoint
2. Poll `/api/transaction/:id` for status
3. Enable 2-3 Railway instances
4. Monitor `/queue` dashboard

### For Low Volume:
1. Use `/topup` endpoint (sync)
2. No need to check status
3. Single instance is fine

### Caching:
- Balance cached for 30 seconds
- Invalidated on: topup, credit adjustment
- Miss penalty: ~40ms

### Queue Management:
- 5 concurrent workers
- 3 retry attempts per job
- Exponential backoff (2s, 4s, 8s)
- Failed jobs kept for 200 attempts

## 🚨 Common Issues

### "Queue system not available"
- Redis not connected
- Check REDIS_URL variable
- Fallback to sync endpoint

### "Insufficient balance"
- Customer balance too low
- Add credit via admin panel
- Check balance at `/api/balance`

### "Invalid currency"
- MUST use `"currency": "MXN"` NOT "USD"
- System automatically uses correct currency

### High failure rate
- Check LATCOM_USER_UID = `20060916` (NOT 28060916)
- Check LATCOM_API_KEY is correct
- Verify phone numbers are 10 digits (no +52)

## 📈 Scaling Checklist

- [ ] Redis service added
- [ ] ADMIN_KEY set
- [ ] Replicas set to 2-3
- [ ] Async endpoint tested
- [ ] Queue monitor accessible
- [ ] Customer notified of new endpoint

## 🔐 Security

- Admin panel requires ADMIN_KEY
- Customer API requires api_key + customer_id
- Redis requires authentication
- Database uses SSL disabled (Railway proxy)

## 📞 Quick Test Commands

Test sync topup:
```bash
curl -X POST https://your-app.up.railway.app/api/enviadespensa/topup \
  -H "Content-Type: application/json" \
  -H "x-api-key: enviadespensa_prod_2025" \
  -H "x-customer-id: ENVIADESPENSA_001" \
  -d '{"phone":"5615622314","amount":20}'
```

Test async topup:
```bash
curl -X POST https://your-app.up.railway.app/api/enviadespensa/topup-async \
  -H "Content-Type: application/json" \
  -H "x-api-key: enviadespensa_prod_2025" \
  -H "x-customer-id: ENVIADESPENSA_001" \
  -d '{"phone":"5615622314","amount":20}'
```

Check balance:
```bash
curl https://your-app.up.railway.app/api/balance \
  -H "x-api-key: enviadespensa_prod_2025" \
  -H "x-customer-id: ENVIADESPENSA_001"
```

---

**System ready for 10,000+ transactions/day!** 🎉
