# Provider Integration Summary

## Complete List of Integrated Providers

### 1. ✅ **Latcom** (`latcom-provider.js`)
- **Status**: ✅ Working on Railway Production
- **Services**: Mexico Movistar/Telefonica mobile topups
- **Products**: XOOM fixed products
  - Available: 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 150, 200, 300, 500 MXN
- **Coverage**: Mexico only
- **Auth**: JWT Bearer token (4-minute expiry)
- **IP**: Requires whitelist (Railway IP `162.220.234.15` is whitelisted)
- **Mode**: `XOOM_ONLY` (enforced for ENVIADESPENSA)
- **Response Time**: ~2-7 seconds
- **Last Tested**: 2025-10-13 ✅ WORKING

### 2. ✅ **CSQ** (`csq-provider.js`)
- **Status**: ✅ Configured (Test & Production)
- **Services**:
  - Prepaid topups (recharges)
  - Postpaid bill payments
  - Vouchers/PINs
- **Coverage**:
  - Mexico (MX)
  - United States (US)
  - Colombia (CO)
  - Brazil (BR)
  - Argentina (AR)
- **Auth**: SHA256 timestamped salted hash
- **API**: REST/JSON (eVSB system)
- **Features**:
  - Multi-country support
  - Supermarket vouchers
  - Transaction reversal/refund
- **Result Codes**:
  - 10 = Success (money moved)
  - 20 = Refund OK
  - 13 = Insufficient balance
  - 977 = Product disabled

### 3. ✅ **PPN (Valuetopup)** (`ppn-provider.js`)
- **Status**: ✅ Configured
- **Services**: International mobile topups
- **Coverage**: Global (multiple countries)
- **Features**:
  - International recharges
  - Gift cards
  - Global operator coverage
- **API**: REST/JSON
- **Use Case**: International topups, fallback provider

### 4. 🆕 **Payments Mexico** (`payments-mexico-provider.js`)
**Formerly known as "Telefonica"**

- **Status**: 🆕 Code complete, needs deployment
- **Services**: Direct Telefonica/Movistar topups
- **API Type**: SOAP/XML Web Service
- **Endpoint**: `http://srm.movistar.com.mx/services/RecargaServicioPort?wsdl`
- **Auth**: PASSWORD_IVR + PUNTO_VENTA (distributor ID)
- **Coverage**: Mexico only
- **Transaction Types**:
  - `00` = Traditional recharge (recarga tradicional)
  - `03` = Packet sale (venta de paquetes)
- **Features**:
  - Direct carrier integration
  - SOAP/XML protocol
  - ISO 8583 support (optional)
- **Requirements**:
  - ⚠️ **VPN ACCESS REQUIRED**
  - Not available on Railway (no VPN)
  - Must deploy to Windows server with VPN
- **Environment Variables**:
  ```bash
  TELEFONICA_WSDL_URL=http://srm.movistar.com.mx/services/RecargaServicioPort?wsdl
  TELEFONICA_PASSWORD_IVR=your_password
  TELEFONICA_PUNTO_VENTA=your_distributor_id
  TELEFONICA_DEFAULT_TYPE=00
  ```
- **Response Codes**:
  - `EXITO` = Success
  - `ERROR` = Failed
  - `DN_INVALIDO` = Invalid phone
  - `MONTO_INVALIDO` = Invalid amount
- **Next Steps**:
  1. Deploy to Windows server
  2. Connect VPN
  3. Configure credentials
  4. Test with VPN connection

### 5. ✅ **MUWE** (`muwe-provider.js`)
**One provider with 4 integrations!**

- **Status**: ✅ Configured (Test & Production)
- **Base URL**: `https://test.sipelatam.mx` (test) / production URL
- **Auth**: MD5 signature (sorted params + secret key)
- **Coverage**: Mexico only

#### 5a. MUWE Integration #1: **Mobile Topups**
- **Pay Type**: 103
- **Operators**: Telcel, AT&T, Movistar, Unefon, Virgin Mobile
- **Requires**: companySku (operator SKU)
- **Method**: POST `/serve/recharge/pay`

#### 5b. MUWE Integration #2: **Bill Payments**
- **Pay Type**: 101
- **Billers**: 100+ companies
- **Features**:
  - Pre-check balance (payType 102)
  - Get biller list
  - Pay bills
- **Requires**: companySku (biller SKU)
- **Method**: POST `/serve/recharge/pay`

#### 5c. MUWE Integration #3: **SPEI Transfers**
- **Service**: Bank transfers (pay-in/pay-out)
- **API**: `/api/unified/transfer/create`
- **Features**:
  - Send money to bank accounts
  - Instant transfers
  - Webhook notifications
- **Headers**: `tmId: sipe_mx`
- **Amount**: Sent in cents

#### 5d. MUWE Integration #4: **OXXO Cash Payments**
- **Service**: Cash collection at OXXO stores
- **API**: `/api/unified/collection/create`
- **Features**:
  - Generate payment voucher
  - Barcode URL
  - Payment URL
  - Expiration time
- **Pay Type**: 3 (CASH)
- **Headers**: `tmId: oxxo_mx`
- **Min Amount**: 10 MXN (1000 cents)

### 6. 🧪 **Mock Provider** (`mock-provider.js`)
- **Status**: ✅ Test mode only
- **Purpose**: Testing and development
- **Activation**: `TEST_MODE=true` or `NODE_ENV=staging`
- **Behavior**: Returns simulated successful responses

## Provider Router System

### Intelligent Routing
The system automatically selects the best provider based on:
- Transaction type
- Country
- Provider availability
- Manual override (if specified)

### Priority Order (Mexico Topups)
```
1. Latcom (primary - best rates)
2. PPN (fallback #1 - global coverage)
3. MUWE (fallback #2 - local provider)
4. Payments Mexico (fallback #3 - direct carrier)
```

### Automatic Failover
- If primary provider fails, automatically tries next provider
- Continues through priority list until success
- Logs all attempts
- Can be disabled with `enableFailover: false`

### Manual Provider Override
```javascript
{
  phone: "5566374683",
  amount: 20,
  preferredProvider: "latcom"  // Force specific provider
}
```

## Customer Management System

### Multi-Tenant Architecture
- ✅ Multiple customers supported
- ✅ Isolated balances per customer
- ✅ Individual API keys
- ✅ Credit limits
- ✅ Commission/discount system

### Authentication
```
Headers:
  x-api-key: customer_api_key
  x-customer-id: CUSTOMER_ID
```

### Current Active Customer
```
Customer ID: ENVIADESPENSA_001
API Key: enviadespensa_prod_2025
Balance: $157.22 USD (as of 2025-10-13)
Credit Limit: $10,000 USD
Status: ACTIVE
```

### Features
- Balance tracking (USD-based)
- Transaction history
- Invoice generation
- CSV exports for reconciliation
- Admin panel
- Customer dashboards
- Commission management

## Total Integration Count

**9 Total Provider Integrations:**
1. Latcom (1 service)
2. CSQ (3 services: topups, bills, vouchers)
3. PPN/Valuetopup (1 service)
4. Payments Mexico (1 service - pending deployment)
5. MUWE Topups (service 1/4)
6. MUWE Bill Payments (service 2/4)
7. MUWE SPEI Transfers (service 3/4)
8. MUWE OXXO Cash (service 4/4)
9. Mock Provider (testing)

**Plus:** Full customer management middleware system

## Environment Variables Summary

### Latcom
```bash
LATCOM_DIST_API=https://lattest.mitopup.com
LATCOM_USERNAME=enviadespensa
LATCOM_PASSWORD=ENV!d32025#
LATCOM_USER_UID=20060916
LATCOM_API_KEY=38aa13413d1431fba1824f2633c2b7d67f5fffcb91b
LATCOM_MODE=XOOM_ONLY
```

### CSQ
```bash
CSQ_BASE_URL=https://evsbus.csqworld.com
CSQ_USERNAME=DEVELOPUS           # Updated 2025-10-13
CSQ_PASSWORD=n7ive4i9ye           # Updated 2025-10-13
CSQ_TERMINAL_ID=173103            # Updated 2025-10-13
CSQ_DEFAULT_OPERATOR_ID=1
```

### PPN
```bash
PPN_BASE_URL=https://api.ppn.com
PPN_API_KEY=your_ppn_key
PPN_MERCHANT_ID=your_merchant_id
```

### MUWE
```bash
MUWE_BASE_URL=https://test.sipelatam.mx
MUWE_MER_CODE=your_merchant_code
MUWE_APP_ID=your_app_id
MUWE_MCH_ID=your_merchant_id
MUWE_SECRET_KEY=ZtIPVopZCwxLiJgrs68MPgNOorWx9CzT
MUWE_ENVIRONMENT=test
```

### Payments Mexico (Telefonica)
```bash
TELEFONICA_WSDL_URL=http://srm.movistar.com.mx/services/RecargaServicioPort?wsdl
TELEFONICA_PASSWORD_IVR=your_password_ivr
TELEFONICA_PUNTO_VENTA=your_distributor_id
TELEFONICA_DEFAULT_TYPE=00
```

## Production Status

### ✅ Working on Railway
- Latcom
- CSQ (configured)
- PPN (configured)
- MUWE (configured)
- Provider Router
- Customer Management

### ⏳ Pending Deployment
- Payments Mexico (needs Windows + VPN)

### 🌐 Railway Production
- **URL**: https://latcom-fix-production.up.railway.app
- **IP**: 162.220.234.15 (whitelisted with Latcom)
- **Database**: PostgreSQL
- **Redis**: Available

## Testing

### Test via Railway Production API
```bash
curl -X POST https://latcom-fix-production.up.railway.app/api/enviadespensa/topup \
  -H "Content-Type: application/json" \
  -H "x-api-key: enviadespensa_prod_2025" \
  -H "x-customer-id: ENVIADESPENSA_001" \
  -d '{"phone":"5566374683","amount":20}'
```

### Test Scripts
- `test-latcom-xoom.js` - Test Latcom XOOM products
- `test-payments-mexico.js` - Test Payments Mexico (needs VPN)
- `test-latcom-debug.js` - Debug Latcom authentication

## Documentation Files

- `PROJECT_CONTEXT.md` - ⭐ Start here for every session
- `PROVIDER_SUMMARY.md` - This file
- `TELEFONICA_INTEGRATION.md` - Payments Mexico technical docs
- `WINDOWS_DEPLOYMENT.md` - Windows deployment guide
- `LATCOM_IP_ISSUE.md` - IP whitelisting troubleshooting
- `README.md` - Project overview

---

**Last Updated**: 2025-10-13
**Status**: 8/9 providers working, 1 pending deployment
**Production**: Railway (all working providers deployed)
