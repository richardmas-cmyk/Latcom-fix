# CSQ Product Access Request

## Date: 2025-10-13

## Issue Summary

We successfully updated to the new development credentials (DEVELOPUS/173103) and authentication is working perfectly. However, when attempting to send topups, we're receiving:

**Error**: `"Producto no disponible en ruta"` (Product not available on route)
**Result Code**: `-1`

## What's Working ✅

- Authentication: **SUCCESS**
- Balance check: **SUCCESS** (Balance: $2,088 USD)
- Connection test: **SUCCESS**
- Parameter retrieval: **SUCCESS** (for operators 1, 2, 3, 396, 683, 684)

## What's NOT Working ❌

- **Topup transactions** with SKU 396 (Telcel)
- Product catalog retrieval endpoints (return 500 errors)

## Test Details

**Test Transaction:**
- Phone: 5527642763 (Telcel Mexico)
- Amount: 20 MXN
- SKU: 396 (Telcel)
- Terminal: 173103

**Response:**
```json
{
  "rc": -1,
  "items": [{
    "finalstatus": -1,
    "resultcode": "-1",
    "resultmessage": "Producto no disponible en ruta"
  }]
}
```

## What We Need from CSQ

### Option 1: Enable Products on Development Terminal
Please enable the following products/SKUs on terminal **173103** for testing:
- **396** - Telcel
- **683** - Amigo Sin Limites
- **684** - Internet Amigo
- Any other Mexican mobile topup products available

### Option 2: Provide Product Catalog
Please send us the complete list of:
- Available product SKUs for terminal 173103
- Operator IDs
- Supported denominations/amounts
- Any restrictions or requirements

### Option 3: Production Credentials
If development terminal has limited access, we can use production credentials instead for full testing.

## API Endpoints Tested

We attempted to retrieve the product catalog automatically but received errors:

❌ `/pre-paid/recharge/operators` - 404 Not Found
❌ `/external-point-of-sale/by-file/operators` - 500 Internal Server Error
❌ `/pre-paid/operators` - 404 Not Found
❌ `/operators` - 500 Internal Server Error
❌ `/products` - 500 Internal Server Error
❌ `/catalogue` - 500 Internal Server Error
❌ `/pre-paid/recharge/products/173103/396` - 500 Internal Server Error

## Working Operators

The following operator IDs returned valid parameters (but transactions fail):
- **1** - Telcel (assumed)
- **2** - Movistar (assumed)
- **3** - AT&T (assumed)
- **396** - Telcel SKU
- **683** - Amigo Sin Limites
- **684** - Internet Amigo

All require: `account` (Phone Number)

## Request

**Could you please:**
1. Enable SKU 396 (Telcel) for terminal 173103, OR
2. Provide the list of available/enabled products for this terminal, OR
3. Let us know the process to get products enabled for testing

## Contact Info

**Your Contact**: Adriana Abad
**Our Terminal**: 173103
**Username**: DEVELOPUS
**Base URL**: https://evsbus.csqworld.com

---

**Gracias por su ayuda!**
