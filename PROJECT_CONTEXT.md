# Latcom-Fix Project Context

## ⚠️ IMPORTANT - READ THIS FIRST IN EVERY SESSION

### Project Status
- **Status**: PRODUCTION - Deployed on Railway
- **Environment**: All credentials are configured on RAILWAY, not locally
- **Database**: PostgreSQL on Railway
- **Redis**: Redis on Railway
- **Current Work**: Building Payments Mexico Mexico integration

### Critical Information
1. **All providers are already configured and working on Railway**
2. **Local .env files are for STAGING/TEST only**
3. **DO NOT test real transactions locally without Railway credentials**
4. **Production credentials are ONLY on Railway environment variables**

## Deployment Architecture

```
LOCAL (Mac) → Git → RAILWAY (Production)
   ↓                      ↓
Test/Dev              Live System
Mock data            Real credentials
.env.staging         Railway env vars
```

## Working Providers (on Railway)

### ✅ Latcom Provider
- **Status**: Configured and working on Railway
- **Supports**: Mexico Movistar/Payments Mexico topups
- **Mode**: XOOM_ONLY (uses fixed XOOM products)
- **Products**: XOOM_10_MXN, XOOM_20_MXN, etc.
- **⚠️ IP Whitelist Required**: Latcom API requires IP whitelisting
- **Current Issue**: Railway IP may need to be whitelisted with Latcom

### ✅ PPN Provider
- **Status**: Configured and working on Railway
- **Supports**: International topups

### ✅ CSQ Provider
- **Status**: Configured and working on Railway
- **Credentials**: Updated 2025-10-13 (DEVELOPUS/173103)
- **Supports**: Topups, bill payments, vouchers
- **Coverage**: Mexico, US, Colombia, Brazil, Argentina

### ✅ MUWE Provider
- **Status**: Configured and working on Railway
- **Supports**: Bill payments, SPEI, OXXO

### 🆕 Payments Mexico Provider
- **Status**: Code complete, ready for Windows server deployment
- **Requires**: VPN access (not available on Railway or Mac)
- **Next Step**: Deploy to Windows server with VPN

## Railway Environment Variables (Production)

### Latcom (Configured on Railway)
```
LATCOM_DIST_API=<configured_on_railway>
LATCOM_USERNAME=<configured_on_railway>
LATCOM_PASSWORD=<configured_on_railway>
LATCOM_USER_UID=<configured_on_railway>
LATCOM_API_KEY=<configured_on_railway>
LATCOM_MODE=XOOM_ONLY
```

### Other Providers
- All production credentials are on Railway
- Do NOT store production credentials locally

## How to Test Transactions

### ❌ WRONG: Testing locally
```bash
# This will FAIL - no credentials locally
node test-latcom-xoom.js
```

### ✅ CORRECT: Test on Railway
```bash
# Option 1: Use Railway CLI
railway run node test-latcom-xoom.js

# Option 2: Test via production API endpoint
curl -X POST https://your-app.railway.app/api/enviadespensa/topup \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY" \
  -d '{"phone":"5566374683","amount":20,"country":"MEXICO"}'

# Option 3: Deploy and test on Railway
git add .
git commit -m "Update"
git push
# Test via Railway production endpoint
```

## Current Session Tasks

### Completed
- [x] Payments Mexico provider implementation
- [x] Provider router integration
- [x] Documentation created
- [x] Test scripts created

### Next Steps
1. If testing Latcom XOOM transactions:
   - Use Railway CLI: `railway run node test-latcom-xoom.js`
   - OR test via Railway production API

2. If deploying Payments Mexico:
   - Transfer code to Windows server
   - Connect VPN
   - Configure Payments Mexico credentials
   - Test on Windows server

## Common Session Start Commands

### When starting a new session:

1. **Check current directory**
```bash
pwd
# Should be: /Users/richardmas/latcom-fix
```

2. **Check Railway status**
```bash
railway status
railway variables  # View environment variables
```

3. **View deployed services**
```bash
railway logs  # View production logs
```

4. **Run tests on Railway**
```bash
railway run node test-latcom-xoom.js
```

## File Structure

```
latcom-fix/
├── server.js                          # Main Express server
├── providers/
│   ├── base-provider.js              # Base class
│   ├── latcom-provider.js            # ✅ Working on Railway
│   ├── ppn-provider.js               # ✅ Working on Railway
│   ├── csq-provider.js               # ✅ Working on Railway
│   ├── muwe-provider.js              # ✅ Working on Railway
│   ├── telefonica-provider.js        # 🆕 Code complete
│   ├── provider-router.js            # Router with failover
│   └── index.js                      # Exports
├── test-latcom-xoom.js               # Test Latcom XOOM 20 MXN
├── test-telefonica.js                # Test Payments Mexico (needs VPN)
├── .env.staging                      # LOCAL test mode only
├── PROJECT_CONTEXT.md                # ⭐ THIS FILE - READ FIRST
├── TELEFONICA_INTEGRATION.md         # Payments Mexico docs
└── WINDOWS_DEPLOYMENT.md             # Windows deployment guide
```

## Quick Reference: What Works Where

| Action | Local Mac | Railway | Windows+VPN |
|--------|-----------|---------|-------------|
| Code development | ✅ Yes | ❌ No | ✅ Yes |
| Latcom testing | ❌ No creds | ✅ Yes | ✅ If configured |
| PPN testing | ❌ No creds | ✅ Yes | ✅ If configured |
| CSQ testing | ⚠️ Staging only | ✅ Yes | ✅ If configured |
| Payments Mexico testing | ❌ No VPN | ❌ No VPN | ✅ Yes |
| Production deployment | ❌ No | ✅ Yes | ⚠️ Payments Mexico only |

## Railway Commands Quick Reference

```bash
# Login to Railway
railway login

# Link to project
railway link

# View environment variables
railway variables

# Set environment variable
railway variables set KEY=VALUE

# Run command with Railway env
railway run <command>

# View logs
railway logs

# Deploy
git push  # Auto-deploys if connected

# Open Railway dashboard
railway open
```

## API Endpoints (Production on Railway)

```
POST /api/enviadespensa/topup           # Synchronous topup
POST /api/enviadespensa/topup-async     # Async topup with queue
GET  /api/balance                       # Check balance
POST /api/admin/providers               # Provider status (admin only)
GET  /api/admin/balances                # Check all provider balances
```

## Test Transaction Details

### Phone Number
- **Test Phone**: 5566374683
- **Format**: 10 digits (Mexican format)
- **Carrier**: Payments Mexico/Movistar (Mexico City area)

### XOOM 20 MXN Product
- **Product ID**: XOOM_20_MXN
- **Amount**: 20 MXN
- **Mode**: Fixed XOOM product (no VAT adjustment)
- **Provider**: Latcom

## Troubleshooting

### "Provider not configured"
- **Cause**: Running locally without credentials
- **Solution**: Use `railway run` or test on Railway production

### "Cannot connect to database"
- **Cause**: Local environment, no Railway DB access
- **Solution**: Use `railway run` to run with Railway environment

### "Test mode enabled"
- **Cause**: .env.staging has TEST_MODE=true
- **Solution**: This is correct for local - use Railway for real tests

## Session Checklist

When starting a new session, check:
- [ ] Read PROJECT_CONTEXT.md (this file)
- [ ] Understand: Production = Railway, Local = Dev only
- [ ] Know which provider you're working on
- [ ] Use `railway run` for any real transaction tests
- [ ] Never commit production credentials to git
- [ ] Check Railway logs if testing production

## Links & Resources

- **Railway Dashboard**: https://railway.app
- **API Documentation**: See server.js for endpoints
- **Provider Docs**: See TELEFONICA_INTEGRATION.md
- **Deployment Guide**: See WINDOWS_DEPLOYMENT.md

---

**Last Updated**: 2025-10-12
**Current Focus**: Payments Mexico integration (code complete, needs Windows+VPN deployment)
**Production Status**: All existing providers working on Railway
