# CSQ Integration - Request and Response Log

**Date**: 2025-10-13
**Terminal**: 173103
**Username**: DEVELOPUS

---

## Test 1: Check Available Products

### REQUEST:
```
GET https://evsbus.csqworld.com/article/view-set/saleconditions/customer-config/173103/0

Headers:
  U: DEVELOPUS
  ST: 1760118152
  SH: 53b2a883b290a7f45ab26953e411d621b779eea15f1cee6cb7bb56698852844
  Accept: application/json
  Accept-Encoding: gzip
  Content-Type: application/json
  X-Real-Ip: 0.0.0.0
  Cache-Hash: 0
  Agent: Relier-Hub/1.0
```

### RESPONSE:
```json
{
  "rc": 0,
  "items": [
    {
      "id": 65275,
      "skuid": 7952,
      "operator": "AT&T Mexico",
      "country": "Mexico",
      "availabledenominationscents": "500, 1000, 1500, 2000, 3000, 5000"
    },
    {
      "id": 78194,
      "skuid": 9990,
      "operator": "DummyTopup",
      "country": "U.S.A.",
      "availabledenominationscents": "From 100 to 1000 step by 1"
    },
    ... (40 total products)
  ]
}
```

**Status**: ✅ SUCCESS - Products list retrieved

---

## Test 2: Balance Check

### REQUEST:
```
GET https://evsbus.csqworld.com/external-point-of-sale/by-file/balances

Headers: (same as above)
```

### RESPONSE:
```json
{
  "rc": 0,
  "items": [
    {
      "id": 173103,
      "balance": 2088
    }
  ]
}
```

**Status**: ✅ SUCCESS - Balance: $2,088 USD

---

## Test 3: Topup with Operator 1 (Generic)

### REQUEST:
```
POST https://evsbus.csqworld.com/pre-paid/recharge/purchase/173103/1/53293194

Headers:
  U: DEVELOPUS
  ST: 1760118093
  SH: (calculated SHA256 hash)
  Accept: application/json
  Accept-Encoding: gzip
  Content-Type: application/json
  X-Real-Ip: 0.0.0.0
  Cache-Hash: 0
  Agent: Relier-Hub/1.0

Body:
{
  "localDateTime": "2025-10-13T11:01:33",
  "account": "5527642763",
  "amountToSendX100": 2000
}
```

### RESPONSE:
```json
{
  "rc": -1,
  "items": [
    {
      "finalstatus": -1,
      "resultcode": "991",
      "resultmessage": "System error",
      "supplierreference": "",
      "suppliertoken": ""
    }
  ]
}
```

**Status**: ❌ FAILED - Result Code 991 (System error)

---

## Test 4: Topup with SKU 396 (Telcel)

### REQUEST:
```
POST https://evsbus.csqworld.com/pre-paid/recharge/purchase/173103/396/12345678

Headers: (same as above)

Body:
{
  "localDateTime": "2025-10-13T10:53:50",
  "account": "5527642763",
  "amountToSendX100": 2000
}
```

### RESPONSE:
```json
{
  "rc": -1,
  "items": [
    {
      "finalstatus": -1,
      "resultcode": "-1",
      "resultmessage": "Producto no disponible en ruta",
      "supplierreference": "",
      "suppliertoken": ""
    }
  ]
}
```

**Status**: ❌ FAILED - Product not available

---

## Test 5: Topup with SKU 9990 (DummyTopup - for testing)

### REQUEST:
```
POST https://evsbus.csqworld.com/pre-paid/recharge/purchase/173103/9990/53411839

Headers: (same as above)

Body:
{
  "localDateTime": "2025-10-13T11:04:11",
  "account": "5527642763",
  "amountToSendX100": 500
}
```

### RESPONSE:
```json
{
  "rc": -1,
  "items": [
    {
      "finalstatus": -1,
      "resultcode": "991",
      "resultmessage": "System error",
      "supplierreference": "",
      "suppliertoken": ""
    }
  ]
}
```

**Status**: ❌ FAILED - Result Code 991 (System error)

---

## Test 6: Topup with SKU 7952 (AT&T Mexico)

### REQUEST:
```
POST https://evsbus.csqworld.com/pre-paid/recharge/purchase/173103/7952/53411900

Headers: (same as above)

Body:
{
  "localDateTime": "2025-10-13T11:05:00",
  "account": "5527642763",
  "amountToSendX100": 2000
}
```

### RESPONSE:
```json
{
  "rc": -1,
  "items": [
    {
      "finalstatus": -1,
      "resultcode": "991",
      "resultmessage": "System error",
      "supplierreference": "",
      "suppliertoken": ""
    }
  ]
}
```

**Status**: ❌ FAILED - Result Code 991 (System error)

---

## Summary

### What's Working ✅
1. Authentication (SHA256 hash generation)
2. Balance check endpoint
3. Product list retrieval endpoint
4. Request format matches specification

### What's NOT Working ❌
1. **All topup transactions return "991 - System error"**
2. Even DummyTopup (SKU 9990) designed for testing fails
3. All operator IDs tested: 1, 2, 3, 396, 683, 684, 7952, 9990

### Operators/SKUs Tested
- Operator 1 (Generic) → Error 991
- Operator 396 (Telcel) → Product not available
- SKU 7952 (AT&T Mexico) → Error 991
- SKU 9990 (DummyTopup) → Error 991

### Result Codes Received
- **991**: General system error
- **-1**: Product not available on route

---

## Questions for CSQ Support

1. **Is terminal 173103 enabled for transactions?**
   - Products are visible in the catalog
   - But all transactions fail with "991 - System error"

2. **Do we need additional configuration?**
   - Terminal activation?
   - IP whitelisting?
   - Additional parameters?

3. **Why does DummyTopup (SKU 9990) fail?**
   - This appears to be a test SKU
   - Should work for development testing
   - But returns same "991" error

4. **What's the correct SKU for Telcel Mexico?**
   - Phone 5527642763 is Telcel
   - No Telcel SKU available in product list
   - Only AT&T Mexico (7952) is available

---

## Environment Details

- **Base URL**: https://evsbus.csqworld.com
- **Terminal**: 173103
- **Username**: DEVELOPUS
- **Password**: n7ive4i9ye
- **Balance**: $2,088 USD (confirmed available)
- **IP Address**: Railway production (varies, but from US/cloud datacenter)

---

## Request Format (Verified Correct)

```json
{
  "localDateTime": "2025-10-13T11:01:33",  // ISO format without timezone
  "account": "5527642763",                  // 10-digit Mexican phone
  "amountToSendX100": 2000                  // 20 MXN in cents
}
```

Endpoint: `/pre-paid/recharge/purchase/{terminal}/{sku}/{reference}`

---

**Need Help With:**
- Getting transactions to work on terminal 173103
- Understanding why "991 - System error" occurs on all SKUs
- Confirmation of correct SKU for Telcel Mexico topups

**Contact**: Richard
**WhatsApp**: (as provided)
**Email**: (if needed)
