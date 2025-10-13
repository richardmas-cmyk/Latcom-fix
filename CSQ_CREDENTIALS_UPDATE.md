# CSQ Development Credentials Update

## Date: 2025-10-13

## Message from Adriana Abad (CSQ)

> Buen dia Richard, espero que estes bien. veo que en su momento te indicaron las credenciales de desarrollo incorrectas
>
> Estas son las credenciales de desarrollo correctas

## OLD Credentials (INCORRECT)
```
User: host.180167
Password: z5r3rr3s96
Terminal: 180167
```

## NEW Credentials (CORRECT) ✅
```
User: DEVELOPUS
Password: n7ive4i9ye
Terminal: 173103
```

## Changes Made

### 1. ✅ Local Environment (.env.staging)
```bash
CSQ_USERNAME=DEVELOPUS
CSQ_PASSWORD=n7ive4i9ye
CSQ_TERMINAL_ID=173103
```

### 2. ✅ Railway Production Environment
Updated via Railway CLI:
```bash
railway variables --set "CSQ_USERNAME=DEVELOPUS"
railway variables --set "CSQ_PASSWORD=n7ive4i9ye"
railway variables --set "CSQ_TERMINAL_ID=173103"
```

### 3. ✅ Example Environment (.env.example)
Updated with comment indicating development credentials

## Verification

### Railway Variables Confirmed:
```
CSQ_BASE_URL: https://evsbus.csqworld.com
CSQ_USERNAME: DEVELOPUS
CSQ_PASSWORD: n7ive4i9ye
CSQ_TERMINAL_ID: 173103
CSQ_DEFAULT_OPERATOR_ID: 1
```

## CSQ Provider Details

### Base URL
```
https://evsbus.csqworld.com
```

### Authentication
- **Type**: SHA256 timestamped salted hash
- **Headers**: U (username), ST (timestamp), SH (hash)
- **Algorithm**:
  1. Hash password with SHA256
  2. Hash timestamp with SHA256
  3. Combine and hash again
  4. Send as headers

### Services
1. **Prepaid Recharge** (Topups)
   - Endpoint: `/pre-paid/recharge/purchase/{terminal}/{sku}/{reference}`
   - SKU Examples:
     - 396 = Telcel
     - 683 = Amigo Sin Limites
     - 684 = Internet Amigo

2. **Postpaid Bill Payment**
   - Endpoint: `/post-paid/bill-payment/payment/{terminal}/{operator}`
   - Flow: Get Parameters → Get Invoices → Payment

3. **Vouchers/PINs**
   - Endpoint: `/pre-paid/vouchers/purchase/{terminal}/{operator}/{reference}`
   - Supports additional data retrieval for PINs

### Coverage
- Mexico (MX)
- United States (US)
- Colombia (CO)
- Brazil (BR)
- Argentina (AR)

### Response Codes
- **10**: Success (money moved)
- **13**: Insufficient balance
- **20**: Refund OK
- **911**: Credit limit exceeded
- **977**: Product temporarily disabled
- **990**: Timeout with operator
- **998**: Unknown error

## Testing CSQ

### Test Script
```bash
# Create test file
cat > test-csq.js << 'EOF'
const CSQProvider = require('./providers/csq-provider');

async function testCSQ() {
    console.log('Testing CSQ with new credentials...\n');

    const provider = new CSQProvider();

    console.log('Provider ready:', provider.isReady());
    console.log('Capabilities:', provider.getCapabilities());

    // Test balance check
    const balance = await provider.checkBalance();
    console.log('\nBalance:', balance);

    // Test topup (example - use real phone for actual test)
    const result = await provider.topup({
        phone: '5512345678',
        amount: 20,
        skuId: '396' // Telcel
    });

    console.log('\nTopup result:', result);
}

testCSQ().catch(console.error);
EOF

# Run test
node test-csq.js
```

### Test via Railway
```bash
railway run node test-csq.js
```

### Test via Production API
```bash
curl -X POST https://latcom-fix-production.up.railway.app/api/enviadespensa/topup \
  -H "Content-Type: application/json" \
  -H "x-api-key: enviadespensa_prod_2025" \
  -H "x-customer-id: ENVIADESPENSA_001" \
  -d '{
    "phone": "5512345678",
    "amount": 20,
    "country": "MEXICO",
    "preferredProvider": "csq",
    "skuId": "396"
  }'
```

## Important Notes

### Development vs Production
- **Development**: DEVELOPUS / n7ive4i9ye / 173103 (current)
- **Production**: Different credentials (to be provided by CSQ)

### When Moving to Production
1. Get production credentials from CSQ/Adriana
2. Update Railway production environment
3. Test thoroughly before going live
4. Keep development credentials for testing

## Contact

**CSQ Contact**: Adriana Abad
**Message**: "Cualquier inquietud, estamos a la orden"

## Next Steps

1. ✅ Credentials updated locally
2. ✅ Credentials updated on Railway
3. ⏳ Test CSQ integration with new credentials
4. ⏳ Verify transaction flow works correctly
5. ⏳ Request production credentials when ready

---

**Updated**: 2025-10-13
**Updated by**: Claude Code (via Railway CLI)
**Status**: Development credentials active ✅
