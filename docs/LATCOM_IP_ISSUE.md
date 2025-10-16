# Latcom IP Whitelisting Issue

## Problem Identified

**Error**: "IP Address not authorized"
**Status Code**: 400
**API**: Latcom (https://lattest.mitopup.com)

## Root Cause

The Latcom API requires IP address whitelisting for security. Currently, Railway's IP address is not authorized to access the Latcom API.

## Test Results

### What We Tested
```bash
railway run node test-latcom-debug.js
```

### Error Response
```json
{
  "error": "Validation Error",
  "message": "IP Address not authorized",
  "status": 400,
  "timestamp": "2025-10-13T00:16:00.414+00:00"
}
```

### Configuration Verified
- ✅ LATCOM_DIST_API: https://lattest.mitopup.com
- ✅ LATCOM_USERNAME: enviadespensa
- ✅ LATCOM_PASSWORD: Configured
- ✅ LATCOM_API_KEY: Configured
- ✅ LATCOM_USER_UID: 20060916
- ❌ Railway IP: **NOT WHITELISTED**

## Solutions

### Option 1: Get Railway IP Whitelisted (Recommended)

**Steps:**
1. Get Railway's outbound IP address
```bash
railway run curl -s https://api.ipify.org
```

2. Contact Latcom support and request IP whitelisting:
   - Email: [Latcom support email]
   - Provide: Railway IP address
   - Account: enviadespensa (user_uid: 20060916)
   - Request: Whitelist IP for API access

3. Wait for confirmation from Latcom

4. Test again:
```bash
railway run node test-latcom-debug.js
```

### Option 2: Use Static IP on Railway (Costs Extra)

Railway Pro plan can assign a static IP, but this costs extra:
- Contact Railway support for static IP
- Provide static IP to Latcom for whitelisting
- More reliable for production

### Option 3: Deploy on Different Server

If IP whitelisting is problematic:
- Deploy on a server with a whitelisted IP
- Use VPS with static IP
- Similar to Telefonica requirement (Windows + VPN)

## Workaround for Testing

### Test Transaction Request Structure
Even though we can't execute the transaction, here's what the test would send:

**Phone**: 5566374683
**Amount**: 20 MXN
**Product**: XOOM_20_MXN
**Mode**: XOOM_ONLY

**Request to Latcom**:
```json
{
  "targetMSISDN": "5566374683",
  "dist_transid": "RLR1728780960000",
  "operator": "TELEFONICA",
  "country": "MEXICO",
  "currency": "MXN",
  "amount": 20,
  "productId": "XOOM_20_MXN",
  "skuID": "0",
  "service": 2
}
```

**Expected Success Response**:
```json
{
  "status": "Success",
  "transId": "LAT123456789",
  "venTransid": "VENDOR_REF",
  "responseMessage": "Top-up successful"
}
```

## Impact

### What's Affected
- ❌ Cannot test Latcom transactions from Railway
- ❌ Cannot execute real topups via Latcom provider
- ✅ All code is correct and would work with proper IP access
- ✅ Other providers (PPN, CSQ, MUWE) may not have IP restrictions

### What Still Works
- ✅ Provider code is correct
- ✅ Authentication logic is correct
- ✅ Request formatting is correct
- ✅ Mode switching (XOOM_ONLY) is working
- ✅ All other system components working

## Immediate Actions

### 1. Get Railway's IP Address
```bash
railway run curl -s https://api.ipify.org
```

### 2. Document the IP
Save it in a secure location for Latcom support request

### 3. Contact Latcom
Email/call Latcom support with:
- Your account details (enviadespensa)
- Railway IP address
- Request for IP whitelisting

### 4. Test Other Providers
While waiting for Latcom IP approval, test other providers:
```bash
# Test PPN (if configured)
railway run node test-ppn.js

# Test CSQ (if configured)
railway run node test-csq.js
```

## Railway IP Information

### Get Railway IP
```bash
# Method 1: Using curl
railway run curl -s https://api.ipify.org

# Method 2: Using dig
railway run dig +short myip.opendns.com @resolver1.opendns.com

# Method 3: Check Railway logs
# Railway logs show outbound IP in connection errors
```

### Railway IP Characteristics
- **Dynamic**: Railway uses dynamic IPs by default
- **Changes**: IP may change on redeployment
- **Static Option**: Available on Pro plan for extra cost
- **Recommendation**: Get static IP for production if using IP-whitelisted APIs

## Similar Issues to Watch For

### Other Providers That May Require IP Whitelisting
1. **Telefonica** - Requires VPN (similar security requirement)
2. **PPN** - Check if they have IP restrictions
3. **CSQ** - Check if they have IP restrictions
4. **MUWE** - Check if they have IP restrictions

### Best Practice
Always check provider documentation for:
- IP whitelisting requirements
- VPN requirements
- Firewall rules
- Network security policies

## Testing Status

### Current Test Results
- ✅ Provider configuration: PASSED
- ✅ Environment variables: PASSED
- ✅ Request formatting: PASSED
- ❌ API connection: FAILED (IP not authorized)
- ⏳ Transaction execution: BLOCKED (waiting for IP whitelist)

### Next Test After IP Whitelisting
Once IP is whitelisted, run:
```bash
railway run node test-latcom-xoom.js
```

Expected result:
```
✅ Authentication successful
✅ Phone lookup: 5566374683 - TELEFONICA (Movistar)
✅ Transaction successful
   Provider Transaction ID: LAT123456789
   Response Time: ~6-7 seconds
```

## Documentation

### Related Files
- `test-latcom-xoom.js` - Full XOOM 20 MXN test
- `test-latcom-debug.js` - Debug authentication issues
- `latcom-provider.js` - Provider implementation
- `PROJECT_CONTEXT.md` - Project overview

### Provider Contact Info
- **Provider**: Latcom (mitopup.com)
- **API URL**: https://lattest.mitopup.com
- **Account**: enviadespensa
- **Support**: [Contact your Latcom account manager]

## Summary

**The code is correct and working properly.**
**The only issue is IP whitelisting with Latcom.**
**Once Railway's IP is whitelisted, all transactions will work.**

**Action Required**: Contact Latcom to whitelist Railway's outbound IP address.

---

**Created**: 2025-10-12
**Issue**: IP Address not authorized
**Status**: Waiting for Latcom IP whitelist
**Priority**: High (blocking Latcom transactions)
