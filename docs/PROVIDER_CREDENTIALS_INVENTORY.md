# Provider Credentials Inventory

**Last Updated:** October 14, 2025

## Executive Summary

This document contains all provider credentials (test and production) for the Relier Hub payment system. The system integrates with 4 providers: CSQ, Latcom, PPN (Valuetopup), and MUWE.

### Current Status Overview

| Provider | Test/Sandbox | Production | Railway Status |
|----------|-------------|------------|----------------|
| **CSQ** | ✅ Working (Terminal 173103) | ⚠️ Products visible but not routed (Terminal 180167) | Using production |
| **Latcom** | ❌ IP blocked (lattest.mitopup.com) | 🔄 Need credentials | Using test (blocked) |
| **PPN** | ✅ Credentials located | 🔄 Need credentials | Using sandbox |
| **MUWE** | ✅ CONFIRMED Working (test.sipelatam.mx) | 🟢 Ready to test - Isaac available | Using test |

### Critical Issues

1. **Latcom IP Whitelist** - Railway IP (162.220.234.15) blocked by Latcom, preventing all transactions
2. **CSQ Production Terminal** - Products visible but getting "Producto no disponible en ruta" error
3. **Mixed Credentials** - Railway production is using test credentials for 3 out of 4 providers
4. **Missing Production Credentials** - Need production credentials for Latcom, PPN, and MUWE

---

## CSQ (CSQ World)

### Test/Sandbox Environment
- **Base URL:** https://evsbus.csqworld.com
- **Terminal ID:** 173103
- **Username:** DEVELOPUS
- **Password:** n7ive4i9ye
- **Token:** 4cdba8f37ecc5ba8994c6a23030c9d4b
- **Status:** ✅ Working
- **Products Available:** 40 products including:
  - DummyTopup (SKU 9990) - For testing
  - AT&T Mexico (SKU 7952)
  - Mexico products available

### Production Environment
- **Base URL:** https://evsbus.csqworld.com
- **Terminal ID:** 180167
- **Username:** host.180167
- **Password:** z5r3rr3s96
- **Status:** ⚠️ Products visible but "Producto no disponible en ruta" error
- **Products Available:** 3 products:
  - Telcel (SKU 396) - 10, 20, 30, 50, 80, 100, 150, 200, 300, 500 MXN
  - Amigo Sin Limites (SKU 683)
  - Internet Amigo (SKU 684)
- **Issue:** Terminal shows products but they're not routed/enabled
- **Action Required:** Contact CSQ to enable routing for SKU 396, 683, 684

---

## Latcom (MiTopup)

### Test/Sandbox Environment
- **Base URL:** https://lattest.mitopup.com
- **Username:** enviadespensa
- **Password:** ENV!d32025#
- **User UID:** 20060916
- **Dist API Key:** 38aa13413d1431fba1824f2633c2b7d67f5fffcb91b043629a0d1fe09df2fb8d
- **Status:** ❌ BLOCKED - IP not whitelisted
- **IP Required:** 162.220.234.15 (Railway production)
- **Action Required:** Latcom must whitelist Railway IP

### Production Environment
- **Status:** 🔄 Pending credentials
- **Action Required:** Obtain production Latcom credentials

---

## PPN (Valuetopup)

### Sandbox Environment
- **Base URL:** https://sandbox.valuetopup.com/api/v2
- **Username:** reliersandbox
- **Password:** uXOu8W8&bF
- **Status:** ✅ Credentials located
- **Features:** 107 countries, 133 operators, 964 SKUs
- **Products:** Mobile topups, bill payments, gift cards, vouchers
- **Authentication:** HTTP Basic Auth (username:password)
- **Note:** PPN uses IP whitelisting in addition to Basic Auth

### Production Environment
- **Base URL:** https://www.valuetopup.com/api/v2
- **Username:** TBD
- **Password:** TBD
- **Status:** 🔄 Need to obtain production credentials
- **Action Required:** Contact PPN to get production credentials and IP whitelist requirements

---

## MUWE

### Test Environment
- **Base URL:** https://test.sipelatam.mx
- **Merchant Code:** 880225000000152
- **Merchant Name:** Monstertech SA de CV
- **App ID:** 00152018863
- **Merchant ID:** 880225000000152
- **Secret Key:** ZtIPVopZCwxLiJgrs68MPgNOorWx9CzT
- **Login:** jdcastillo@latcom.co
- **Status:** ✅ CONFIRMED WORKING (October 14, 2025)
- **Features:** Bill payments (71 billers), mobile topups (29 operators), SPEI transfers, OXXO cash
- **Countries:** Mexico only
- **Operators:** TAETelcel, TAEMOVISTAR, TAEIUSACELL, TAEVIRGIN, TAEUNEFON, Bait, FreedomPop, and 22 more
- **Authentication:** MD5 signature (sorted params + secret key)
- **IP Whitelist:** Already completed (no additional IPs needed)
- **Confirmed by:** Isaac Suarez (isaac.suarez@muwe.mx) - October 14, 2025

### Production Environment
- **Base URL:** https://pay.sipelatam.mx
- **Merchant Code:** TBD
- **App ID:** TBD
- **Merchant ID:** TBD
- **Secret Key:** TBD
- **Status:** 🟢 READY FOR TESTING - Isaac offered to help test in PRD
- **Action Required:** Email Isaac Suarez (isaac.suarez@muwe.mx) to request production credentials and coordinate testing
- **Note:** Isaac confirmed sandbox test was successful and is ready to help with production testing

---

## Current Railway Configuration (Production)

**Issue:** Railway is currently running with MIXED test/production credentials
- CSQ: Production terminal (180167) ✅
- Latcom: Test environment (lattest.mitopup.com) ⚠️
- PPN: Sandbox credentials ⚠️
- MUWE: Test environment ⚠️

```
# CSQ - PRODUCTION ✅
CSQ_BASE_URL=https://evsbus.csqworld.com
CSQ_TERMINAL_ID=180167
CSQ_USERNAME=host.180167
CSQ_PASSWORD=z5r3rr3s96

# Latcom - TEST ENVIRONMENT ⚠️ (Should be production)
LATCOM_DIST_API=https://lattest.mitopup.com
LATCOM_USERNAME=enviadespensa
LATCOM_PASSWORD=ENV!d32025#
LATCOM_USER_UID=20060916
LATCOM_API_KEY=38aa13413d1431fba1824f2633c2b7d67f5fffcb91b043629a0d1fe09df2fb8d
LATCOM_MODE=XOOM_ONLY

# PPN - SANDBOX ⚠️ (Should be production)
PPN_BASE_URL=https://sandbox.valuetopup.com/api/v2
PPN_USERNAME=reliersandbox
PPN_PASSWORD=uXOu8W8&bF
PPN_ENVIRONMENT=sandbox

# MUWE - TEST ⚠️ (Should be production)
MUWE_BASE_URL=https://test.sipelatam.mx
MUWE_MER_CODE=880225000000152
MUWE_APP_ID=00152018863
MUWE_MCH_ID=880225000000152
MUWE_ENVIRONMENT=test
```

**⚠️ CRITICAL:** Railway production is using test credentials for Latcom, PPN, and MUWE. This needs to be fixed once production credentials are obtained.

---

## Recommended Environment Setup

### Option A: Separate Railway Services

```
Project: Relier-Hub
│
├── Service: relier-hub-production
│   ├── Database: PostgreSQL (production)
│   ├── Redis: Redis (production)
│   └── Variables:
│       ├── CSQ_TERMINAL_ID=180167
│       ├── CSQ_USERNAME=host.180167
│       ├── CSQ_PASSWORD=z5r3rr3s96
│       ├── LATCOM_USERNAME=[production_user]
│       ├── LATCOM_DIST_API=[production_url]
│       ├── PPN_* (production credentials)
│       └── DATABASE_URL=[production_db]
│
└── Service: relier-hub-staging
    ├── Database: PostgreSQL (test)
    ├── Redis: Redis (shared or separate)
    └── Variables:
        ├── CSQ_TERMINAL_ID=173103
        ├── CSQ_USERNAME=DEVELOPUS
        ├── CSQ_PASSWORD=n7ive4i9ye
        ├── LATCOM_USERNAME=enviadespensa
        ├── LATCOM_DIST_API=https://lattest.mitopup.com
        ├── PPN_* (sandbox credentials)
        └── DATABASE_URL=[test_db]
```

### Option B: Single Service with Multiple Environments

```
Service: relier-hub
├── Environment: production
│   └── Variables: [production credentials]
├── Environment: staging
│   └── Variables: [sandbox credentials]
└── Environment: development
    └── Variables: [local dev credentials]
```

---

## Environment Variable Templates

### .env.staging (Sandbox/Test)
```bash
# Server
NODE_ENV=staging
PORT=8080

# CSQ - Test Terminal
CSQ_BASE_URL=https://evsbus.csqworld.com
CSQ_TERMINAL_ID=173103
CSQ_USERNAME=DEVELOPUS
CSQ_PASSWORD=n7ive4i9ye
CSQ_TOKEN=4cdba8f37ecc5ba8994c6a23030c9d4b

# Latcom - Test Environment
LATCOM_DIST_API=https://lattest.mitopup.com
LATCOM_USERNAME=enviadespensa
LATCOM_PASSWORD=ENV!d32025#
LATCOM_USER_UID=20060916
LATCOM_API_KEY=38aa13413d1431fba1824f2633c2b7d67f5fffcb91b043629a0d1fe09df2fb8d
LATCOM_MODE=RAW

# PPN - Sandbox
PPN_BASE_URL=https://sandbox.valuetopup.com/api/v2
PPN_USERNAME=reliersandbox
PPN_PASSWORD=uXOu8W8&bF
PPN_ENVIRONMENT=sandbox

# MUWE - Test
MUWE_BASE_URL=https://test.sipelatam.mx
MUWE_MER_CODE=880225000000152
MUWE_APP_ID=00152018863
MUWE_MCH_ID=880225000000152
MUWE_SECRET_KEY=ZtIPVopZCwxLiJgrs68MPgNOorWx9CzT
MUWE_ENVIRONMENT=test

# Database - Test
DATABASE_URL=[test_database_url]

# Admin
ADMIN_KEY=relier_admin_staging_2025
TEST_KEY=relier_test_2025
```

### .env.production
```bash
# Server
NODE_ENV=production
PORT=8080

# CSQ - Production Terminal
CSQ_BASE_URL=https://evsbus.csqworld.com
CSQ_TERMINAL_ID=180167
CSQ_USERNAME=host.180167
CSQ_PASSWORD=z5r3rr3s96
CSQ_TOKEN=[production_token_if_different]

# Latcom - Production
LATCOM_DIST_API=[production_url_when_available]
LATCOM_USERNAME=[production_username]
LATCOM_PASSWORD=[production_password]
LATCOM_USER_UID=[production_uid]
LATCOM_API_KEY=[production_api_key]
LATCOM_MODE=XOOM_ONLY

# PPN - Production
PPN_BASE_URL=https://www.valuetopup.com/api/v2
PPN_USERNAME=[production_username]
PPN_PASSWORD=[production_password]
PPN_ENVIRONMENT=production

# MUWE - Production
MUWE_BASE_URL=[production_url]
MUWE_MER_CODE=[production_mer_code]
MUWE_APP_ID=[production_app_id]
MUWE_MCH_ID=[production_mch_id]
MUWE_SECRET_KEY=[production_secret_key]
MUWE_ENVIRONMENT=production

# Database - Production
DATABASE_URL=[production_database_url]

# Admin
ADMIN_KEY=relier_admin_prod_2025
RECONCILE_KEY=[production_reconcile_key]
```

---

## Next Steps

1. **Locate PPN Credentials** ✅ PARTIALLY COMPLETE
   - [x] Find PPN sandbox credentials (reliersandbox)
   - [ ] Find PPN production credentials
   - [x] Document PPN API endpoints

2. **Get Latcom Production Credentials** ⚠️ PENDING
   - [ ] Request production credentials from Latcom (User will get these)
   - [ ] Get production IP whitelisted (162.220.234.15)

3. **Fix CSQ Production** ⚠️ BLOCKING
   - [ ] Contact CSQ to enable routing for terminal 180167
   - [ ] Verify SKU 396, 683, 684 work
   - **Issue:** Products visible but "Producto no disponible en ruta"

4. **Get MUWE Production Credentials** 🔄 NEW
   - [ ] Contact MUWE for production credentials
   - [ ] Get production merchant code, app ID, secret key

5. **Get PPN Production Credentials** 🔄 NEW
   - [ ] Contact PPN for production credentials
   - [ ] Get production IP whitelist requirements

6. **Set Up Railway Environments** 🔄 PENDING
   - [ ] Create staging service or environment
   - [ ] Deploy code to both environments
   - [ ] Test all providers in staging
   - [ ] Promote to production with correct credentials

7. **Document Testing Procedures**
   - [ ] Create test scripts for each provider
   - [ ] Document test phone numbers
   - [ ] Create smoke test suite

---

## Testing Checklist

### CSQ
- [ ] Test: DummyTopup (9990) with account ending in 000
- [ ] Test: Telcel (396) with 10 MXN to 5527642763
- [ ] Test: AT&T Mexico (7952) with valid amount
- [ ] Verify: Balance check works

### Latcom
- [ ] Test: XOOM 20 MXN topup
- [ ] Test: Token refresh
- [ ] Verify: IP whitelisted
- [ ] Test: Phone lookup

### PPN
- [ ] Test: [TBD once credentials located]
- [ ] Verify: Authentication works
- [ ] Test: Balance check

### Multi-Provider Failover
- [ ] Test: Primary provider success
- [ ] Test: Primary fails, secondary succeeds
- [ ] Test: All providers fail, proper error

---

**Last Updated:** October 14, 2025
