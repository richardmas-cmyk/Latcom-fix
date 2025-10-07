# XOOM Product Test Report for Latcom Technical Support

**Date:** October 4, 2025
**Issue:** XOOM products returning "Product not Found" error
**Error Code:** -120054

---

## Request Details

### Endpoint
```
POST https://disapi.latcom.mx/api/tn/fast
```

### Headers
```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer [ACCESS_TOKEN from /api/dislogin]"
}
```

### Request Body (XOOM_010_MXN)
```json
{
  "targetMSISDN": "5615870508",
  "dist_transid": "TEST_1759581921940",
  "operator": "TELEFONICA",
  "country": "MEXICO",
  "currency": "MXN",
  "amount": 10,
  "productId": "XOOM_010_MXN",
  "skuID": "0",
  "service": 2
}
```

---

## Response Details

### HTTP Status
```
200 OK
```

### Response Body
```json
{
  "uid": "c9c3a127-db45-431b-a881-1125ffd55a41",
  "amount": 10,
  "productId": "XOOM_010_MXN",
  "service": 2,
  "transId": "LT48966777",
  "status": "Fail",
  "createdAt": "2025-10-04T08:44:46.915215047-04:00",
  "venTransid": null,
  "responseCode": null,
  "responseMessage": null,
  "vendorResponseMsg": "Product not Found",
  "vendorResponseCode": "-120054",
  "distTransid": "TEST_1759581921940",
  "endedAt": "2025-10-04T08:44:46.929166111-04:00"
}
```

---

## Additional Test Results

### Test 1: XOOM_010_MXN
- **Amount:** 10 MXN
- **Result:** ❌ FAIL - "Product not Found" (-120054)
- **Transaction ID:** LT48966777

### Test 2: XOOM_020_MXN
**Request Body:**
```json
{
  "targetMSISDN": "5615870508",
  "dist_transid": "TEST_1759581500436",
  "operator": "TELEFONICA",
  "country": "MEXICO",
  "currency": "MXN",
  "amount": 20,
  "productId": "XOOM_020_MXN",
  "skuID": "0",
  "service": 2
}
```
- **Result:** Expected to fail with same error
- **Transaction ID:** LT25912727

---

## Working Product (for comparison)

### TFE_MXN_20_TO_2000 (Open Range)
**Request Body:**
```json
{
  "targetMSISDN": "5615870508",
  "dist_transid": "RLR1759581867966",
  "operator": "TELEFONICA",
  "country": "MEXICO",
  "currency": "MXN",
  "amount": 25,
  "productId": "TFE_MXN_20_TO_2000",
  "skuID": "0",
  "service": 2
}
```
- **Result:** ✅ SUCCESS
- **Transaction ID:** LT14272655
- **Status:** Success

---

## Products Requiring Activation

Based on the catalog provided (Catálogo Recargas Internacionales Latcom_20251001.xlsx), we need the following XOOM products enabled:

### Fixed Amount Topups (Service 2, Currency: MXN)
1. XOOM_010_MXN - 10 pesos
2. XOOM_020_MXN - 20 pesos
3. XOOM_030_MXN - 30 pesos
4. XOOM_040_MXN - 40 pesos
5. XOOM_050_MXN - 50 pesos
6. XOOM_060_MXN - 60 pesos
7. XOOM_070_MXN - 70 pesos
8. XOOM_080_MXN - 80 pesos
9. XOOM_090_MXN - 90 pesos
10. XOOM_100_MXN - 100 pesos
11. XOOM_150_MXN - 150 pesos
12. XOOM_200_MXN - 200 pesos
13. XOOM_300_MXN - 300 pesos
14. XOOM_500_MXN - 500 pesos

---

## Account Information

- **Account/Username:** [Your Latcom username]
- **Distributor API Key:** [Your dist_api]
- **Current Working Products:** TFE_MXN_20_TO_2000 (open range topup)

---

## Request

Please enable the XOOM product line for our account. All products are listed in your catalog document "Catálogo Recargas Internacionales Latcom_20251001.xlsx" under "PRODUCTOS TELEFÓNICA MÉXICO".

According to the catalog, these should be available for Telefónica México topups with Service 2, where the amount field matches the product ID number (e.g., XOOM_010_MXN requires amount: 10).

---

## Technical Contact

Please confirm when these products are activated so we can proceed with testing and production deployment.
