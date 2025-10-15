# Provider Routes Disabled - October 15, 2025

## Why Routes Were Disabled

**Date:** October 15, 2025
**Reason:** Prevent using sandbox/test credentials in production

---

## Current Provider Status

### ❌ DISABLED PROVIDERS

**1. Latcom**
- **Status:** IP Blocked
- **Issue:** Railway IP (162.220.234.15) not whitelisted
- **Environment:** Test (lattest.mitopup.com)
- **Action Required:** Get production credentials OR whitelist IP
- **Disabled In:** `mexico_topup`, `international_topup` routes

**2. PPN (Valuetopup)**
- **Status:** Sandbox Only
- **Issue:** Using test credentials (reliersandbox)
- **Environment:** Sandbox (sandbox.valuetopup.com)
- **Action Required:** Get production credentials
- **Disabled In:** `mexico_topup`, `international_topup`, `voucher` routes

**3. MUWE**
- **Status:** Sandbox/Test Only
- **Issue:** Using test credentials (880225000000152)
- **Environment:** Test (test.sipelatam.mx)
- **Action Required:** Get production credentials
- **Disabled In:** `mexico_topup`, `bill_payment`, `spei`, `oxxo` routes

**4. Payments Mexico**
- **Status:** Unknown Configuration
- **Action Required:** Verify if configured/working
- **Disabled In:** `mexico_topup` route

---

## ✅ ACTIVE PROVIDER

**CSQ (CSQ World)**
- **Status:** Production Terminal (⚠️ with routing issues)
- **Terminal ID:** 180167
- **Environment:** Production (evsbus.csqworld.com)
- **Issue:** Products visible but "Producto no disponible en ruta"
- **Products:** Telcel (SKU 396), Amigo Sin Limites (SKU 683), Internet Amigo (SKU 684)
- **Action Required:** Contact CSQ to enable routing for terminal 180167
- **Active In:** `mexico_topup`, `international_topup` routes (ONLY provider)

---

## Current Routing Configuration

```javascript
this.preferences = {
    mexico_topup: ['csq'],           // CSQ only
    international_topup: ['csq'],    // CSQ only
    bill_payment: [],                // DISABLED - no production provider
    voucher: [],                     // DISABLED - no production provider
    spei: [],                        // DISABLED - no production provider
    oxxo: []                         // DISABLED - no production provider
};
```

---

## What This Means

### ✅ Mexico Topups
- **Will use:** CSQ production terminal 180167
- **Will work:** Once CSQ enables routing for SKU 396, 683, 684
- **Currently:** May fail with "Producto no disponible en ruta"

### ❌ Bill Payments
- **Status:** DISABLED
- **Reason:** MUWE is sandbox only
- **Will return:** Error - no available provider

### ❌ Vouchers/Gift Cards
- **Status:** DISABLED
- **Reason:** PPN is sandbox only
- **Will return:** Error - no available provider

### ❌ SPEI Transfers
- **Status:** DISABLED
- **Reason:** MUWE is sandbox only
- **Will return:** Error - no available provider

### ❌ OXXO Cash Payments
- **Status:** DISABLED
- **Reason:** MUWE is sandbox only
- **Will return:** Error - no available provider

---

## Why Last Night's Tests Succeeded

**What happened:**
1. Customer requested topup
2. System tried Latcom first → FAILED (IP blocked)
3. System automatically failed over to **PPN sandbox** → SUCCESS

**Why it worked:**
- PPN sandbox was still in the provider route list
- Automatic failover kicked in
- PPN sandbox processed the transaction

**Problem:**
- ✅ Customer didn't notice any issue (good)
- ⚠️ Using sandbox/test environment for real money (bad)
- ⚠️ Potential for sandbox limits, restrictions, or shutdown

**Solution:**
- Routes now disabled to prevent using sandbox in production
- System will use CSQ only (production terminal)
- Need to fix CSQ routing issue OR get production credentials

---

## Next Steps to Re-Enable Services

### 1. Enable Latcom
- [ ] Contact Latcom to whitelist IP: 162.220.234.15
- [ ] OR get production Latcom credentials
- [ ] Test authentication
- [ ] Re-enable in `mexico_topup` route (as first priority)

### 2. Enable PPN
- [ ] Email PPN to request production credentials
- [ ] Get production IP whitelist requirements
- [ ] Configure production credentials
- [ ] Re-enable in `international_topup` and `voucher` routes

### 3. Enable MUWE
- [ ] Email Isaac for production credentials (Bill Payment + OXXO)
- [ ] Get production mchId, appId, merCode
- [ ] Configure production credentials
- [ ] Re-enable in `bill_payment`, `spei`, `oxxo` routes

### 4. Fix CSQ Production
- [ ] Contact CSQ (Mariela) to enable routing for terminal 180167
- [ ] Verify SKU 396, 683, 684 work
- [ ] Test with real phone number

---

## Rollback Instructions

If you need to re-enable the failover routes (NOT RECOMMENDED):

```javascript
// In provider-router.js, change back to:
this.preferences = {
    mexico_topup: ['latcom', 'ppn', 'muwe', 'csq'],
    international_topup: ['ppn', 'csq'],
    bill_payment: ['muwe', 'csq', 'ppn'],
    voucher: ['ppn', 'csq'],
    spei: ['muwe'],
    oxxo: ['muwe']
};
```

**Warning:** This will use sandbox/test environments for real transactions!

---

## Modified Files

1. `providers/provider-router.js` - Disabled routes (lines 35-50)
2. `PROVIDER_ROUTES_DISABLED.md` - This documentation

---

**Last Updated:** October 15, 2025
