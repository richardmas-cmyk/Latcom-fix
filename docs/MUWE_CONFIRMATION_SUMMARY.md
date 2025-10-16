# MUWE Integration Status - Confirmed by Isaac Suarez

**Date:** October 14, 2025
**Contact:** Isaac Suarez (isaac.suarez@muwe.mx)
**Status:** ✅ SANDBOX ACTIVE, Ready for Production Testing

---

## What Isaac Confirmed (October 13-14, 2025)

### Account Status
- ✅ **Account REACTIVATED** - The service was blocked but is now active again
- ✅ **Test successful** - MUWE team confirmed sandbox testing was successful
- ✅ **Ready for Production** - Isaac is offering to help test in PRD (production)

### Questions Answered

**Q: ¿Nuestra cuenta está completamente activada para acceder a la API?**
> A: **Ya se encuentra activada de nuevo** (Already reactivated)

**Q: ¿Es necesario hacer whitelist de alguna IP?**
> A: **No, si ya realizaron el proceso de enviar sus IPS a los correos ya no es necesario.**
> Translation: No, if you already sent your IPs to the emails, it's not necessary anymore

**Q: ¿El endpoint /serve/obtain/serveList es el correcto?**
> A: **Sí** (Yes, it's correct)

**Q: ¿Necesitamos alguna key adicional o configuración especial?**
> A: **No, solo probar con los mismo datos de la documentacion de SANDBOX**
> Translation: No, just test with the same data from the SANDBOX documentation

**Q: ¿Existe documentación actualizada?**
> A: **Si, solo estaba bloqueado el servicio pero ya esta activo de nuevo.**
> Translation: Yes, the service was just blocked but it's active again

---

## Test Results (October 14, 2025)

### ✅ MUWE Sandbox - WORKING

**Merchant Account:**
- Merchant ID: 880225000000152
- Merchant Name: Monstertech SA de CV
- App ID: 00152018863
- Base URL: https://test.sipelatam.mx
- Secret Key: ZtIPVopZCwxLiJgrs68MPgNOorWx9CzT

**Test Results:**
```
✅ Get Bill Companies: 71 companies found
✅ Get Topup Operators: 29 operators found
✅ OXXO Payment Creation: Voucher created successfully
✅ MD5 Signature: Working correctly
✅ Authentication: Successful
```

### Available Services

**Mobile Topup Operators (29 total):**
- TAETelcel (SKU: 4013603024)
- TAEMOVISTAR (SKU: 4013597028)
- TAEIUSACELL (SKU: 4013599024)
- TAEVIRGIN (SKU: 4013601028)
- TAEUNEFON (SKU: 4013600020)
- Bait (SKU: 4029866029)
- FreedomPop (SKU: 4029867027)
- And 22 more operators

**Bill Payment Companies (71 total):**
- Dish ON (Satellite)
- Infonavit (Mortgage)
- Natura (Media Subscription)
- Water utilities (INTERAPAS, etc.)
- And 67 more billers

**OXXO Cash Payments:**
- ✅ Voucher creation working
- ✅ Barcode generation working
- Minimum: 10 MXN (1000 cents)

---

## Next Steps - Production Migration

### What Isaac Offered
> "Buen dia me puedes ayudar a volver a intentarlo? Ya realice una prueba en testing y salio exitosa, me ayudan a probarlo en PRD?"
>
> Translation: "Good morning, can you help me try again? I already did a test in testing and it was successful, can you help me test it in PRD?"

**Isaac is ready to help us test in PRODUCTION!**

### What We Need to Do

1. **Request Production Credentials from MUWE**
   - Production Merchant Code
   - Production App ID
   - Production Merchant ID (mchId)
   - Production Secret Key
   - Production Base URL confirmation (https://pay.sipelatam.mx)

2. **Coordinate Production Testing with Isaac**
   - Email: isaac.suarez@muwe.mx
   - Test real topup transaction
   - Test real bill payment
   - Verify OXXO payment flow

3. **IP Whitelist** (Already Done)
   - Isaac confirmed: "No, si ya realizaron el proceso de enviar sus IPS a los correos ya no es necesario."
   - Our IPs were already submitted and whitelisted

---

## Integration Status by Provider

| Provider | Sandbox | Production | Contact |
|----------|---------|------------|---------|
| **MUWE** | ✅ Working | 🔄 Ready to test | Isaac Suarez (isaac.suarez@muwe.mx) |
| **CSQ** | ✅ Working | ⚠️ Products not routed | Mariela (csq contact) |
| **Latcom** | ❌ IP blocked | 🔄 Need credentials | Latcom support |
| **PPN** | ✅ Credentials found | 🔄 Need credentials | PPN support |

---

## Technical Notes

### MUWE Authentication Method
MUWE uses **MD5 signature** authentication:

```javascript
// Algorithm:
1. Filter params (remove null/undefined/empty and 'sign' field)
2. Sort params alphabetically by key
3. Build string: key1=value1&key2=value2...
4. Append: &key=SECRET_KEY
5. MD5 hash and convert to UPPERCASE

// Example:
const stringSignTemp = `merCode=880225000000152&nonceStr=1760184361566&payType=101&key=ZtIPVopZCwxLiJgrs68MPgNOorWx9CzT`;
const sign = crypto.createHash('md5').update(stringSignTemp).digest('hex').toUpperCase();
// Result: DF4D0FCE32BEE3857CB13EEF1A7859ED
```

### MUWE Endpoints Confirmed Working

**Bill Payment API:**
- ✅ `POST /serve/obtain/serveList` - Get list of companies
- ✅ `POST /serve/recharge/pay` - Submit payment (payType: 101=bills, 103=topups)
- ⚠️ `POST /serve/recharge/checkBalance` - Check bill balance (not all billers support)

**OXXO API:**
- ✅ `POST /api/unified/collection/create` - Create OXXO voucher
- Headers required: `tmId: oxxo_mx`

**SPEI API:**
- ⏳ Not tested yet
- `POST /api/unified/transfer/create` - Bank transfer
- Headers required: `tmId: sipe_mx`

---

## Email Thread Context

**Original Issue (October 11-12):**
- Richard reported 404 error on /serve/obtain/serveList
- Account appeared to be blocked or inactive

**MUWE Response (October 13):**
- Isaac: "ya estoy solicitando el despligue al equipo de china por el error 404"
- Translation: "I'm requesting the deployment from the China team for the 404 error"

**Resolution (October 14):**
- Isaac confirmed service is now active
- Test successful
- Ready to help with production testing

---

## Action Items

- [ ] Email Isaac to request production credentials
- [ ] Coordinate production test with Isaac
- [ ] Test production endpoints with real transactions
- [ ] Document production API key and merchant details
- [ ] Update Railway environment variables with production credentials

---

## Contact Information

**MUWE Support:**
- Isaac Suarez: isaac.suarez@muwe.mx
- Mario Salas: mario.salas@muwe.mx (LATAM Group - Director de Producto & Comercial)
- Phone: +52 56 2486 0840

**Documentation:**
- Apifox: https://apifox.com/apidoc/shared-7b284c45-1f31-4745-8032-d577c8ace9f8

---

**Last Updated:** October 14, 2025
