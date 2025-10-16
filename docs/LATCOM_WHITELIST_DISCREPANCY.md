# Latcom IP Whitelist Discrepancy Report

**Date:** October 15, 2025, 12:01 PM UTC
**Issue:** Latcom states IP is whitelisted, but Railway still getting blocked

---

## The Contradiction

### What Latcom Says:
> "the IP IS IN WORKING ORDER"

### What We're Experiencing:
```
Response Status: 400
Response Body: {
  "error": "Validation Error",
  "message": "IP Address not authorized",
  "status": 400,
  "timestamp": "2025-10-15T11:59:28.013+00:00"
}
```

---

## Railway Production IP

**Confirmed IP:** 162.220.234.15

**Verified by:**
- `/api/check-ip` endpoint: ✅ 162.220.234.15
- Multiple tests over past week: ✅ Stable (no changes)
- DNS resolution: ✅ Working
- Network connectivity: ✅ Working

---

## Test Results from Railway Production

**Test Run:** October 15, 2025, 11:59 AM UTC
**Source IP:** 162.220.234.15 (Railway)
**Destination:** https://lattest.mitopup.com/api/dislogin

**Request:**
```json
{
  "username": "enviadespensa",
  "password": "ENV!d32025#",
  "dist_api": "38aa13413d1431fba1824f2633c2b7d67f5fffcb91b043629a0d1fe09df2fb8d",
  "user_uid": "20060916"
}
```

**Response:**
```json
{
  "error": "Validation Error",
  "message": "IP Address not authorized",
  "status": 400,
  "timestamp": "2025-10-15T11:59:28.013+00:00"
}
```

✅ Request reaches Latcom server (gets 400 response)
❌ IP whitelist validation fails

---

## Possible Explanations

### 1. **Wrong IP Whitelisted**
- Latcom may have whitelisted a different IP
- Need to confirm with Latcom: **What IP do they have in their whitelist?**

### 2. **Multiple IPs Required**
- Railway may use multiple outbound IPs
- Need to whitelist entire IP range
- Railway's IP range: **162.220.234.0/24** (or specific IPs)

### 3. **Environment Mismatch**
- Latcom may have whitelisted for **production** environment
- We're testing against **test** environment (lattest.mitopup.com)
- Different environments = different whitelists?

### 4. **Recent Configuration Change**
- Latcom may have recently updated whitelist
- Change hasn't propagated yet (caching)
- Or accidentally removed our IP

### 5. **Username/UID Association**
- IP whitelist may be tied to specific username/UID
- Our credentials: `enviadespensa` / UID `20060916`
- IP may be whitelisted for different account

---

## Questions for Latcom

### 🔴 CRITICAL QUESTIONS:

1. **What exact IP address do you have whitelisted for our account?**
   - We're using: 162.220.234.15
   - Please confirm this matches your whitelist

2. **Which environment is the IP whitelisted for?**
   - Production (https://latprod.mitopup.com)?
   - Test/Sandbox (https://lattest.mitopup.com)?
   - Both?

3. **Which account/username is the IP whitelisted under?**
   - Our test account: enviadespensa / UID 20060916
   - Production account (if different)?

4. **When was the IP last updated in your whitelist?**
   - We've been blocked for over a week
   - Was there a recent change?

5. **Does Railway's IP range need to be whitelisted?**
   - Single IP: 162.220.234.15
   - Or range: 162.220.234.0/24

---

## What We've Ruled Out

✅ **DNS Issues** - lattest.mitopup.com resolves correctly
✅ **Network Issues** - Can reach Latcom server (gets 400 response)
✅ **IP Stability** - Railway IP hasn't changed (verified multiple times)
✅ **Credentials** - Username/password/UID are correct (same as worked before)
✅ **Code Changes** - No recent changes to Latcom authentication logic
✅ **Environment Variables** - All Latcom config correct in Railway

---

## Evidence of Previous Working State

### Customer Transactions (Last Night):
- 2 successful topup transactions
- Used **automatic failover** to PPN (because Latcom was blocked)
- Proves system was routing to Latcom first, then failing over

### Historical Data:
- System worked with Latcom for weeks
- Same IP (162.220.234.15)
- Same credentials (enviadespensa)
- Same environment (lattest.mitopup.com)

**Conclusion:** Something changed on Latcom's side, not ours.

---

## Request to Latcom Support

Subject: **IP Whitelist Verification - enviadespensa Account**

---

Hola Latcom Support,

Necesitamos verificar el estado de nuestra IP whitelist.

**Nuestros Datos:**
- Username: enviadespensa
- User UID: 20060916
- IP Address: 162.220.234.15
- Ambiente: lattest.mitopup.com (test/sandbox)
- Servidor: Railway (latcom-fix-production.up.railway.app)

**Problema:**
Recibimos error "IP Address not authorized" desde hace más de una semana, pero ustedes indican que "the IP IS IN WORKING ORDER".

**Por favor confirmar:**

1. ¿Qué dirección IP tienen registrada para nuestra cuenta?
   → Esperamos: 162.220.234.15

2. ¿Para qué ambiente está habilitada la IP?
   → Esperamos: lattest.mitopup.com (sandbox/test)

3. ¿Para qué usuario está asociada la IP?
   → Esperamos: enviadespensa / UID 20060916

4. ¿Cuándo fue la última actualización de la whitelist?

**Prueba Actual:**
```
POST https://lattest.mitopup.com/api/dislogin
From IP: 162.220.234.15
Timestamp: 2025-10-15 11:59:28 UTC

Response: 400 Bad Request
Error: "IP Address not authorized"
```

Por favor ayúdennos a resolver esta discrepancia.

Gracias,
Richard Mas
Latcom / Exodus-II
richard.mas@latcom.co

---

## Next Steps

### Immediate:
1. **Contact Latcom** with questions above
2. **Ask them to verify** what IP they have whitelisted
3. **Request screenshot/proof** of whitelist configuration

### If IP Mismatch Found:
1. Update whitelist with correct IP: 162.220.234.15
2. Retest authentication
3. Enable Latcom in provider routes

### If Configuration Issue Found:
1. Determine correct environment (test vs production)
2. Get appropriate credentials/whitelist
3. Update Railway environment variables

---

**Last Updated:** October 15, 2025, 12:01 PM UTC
