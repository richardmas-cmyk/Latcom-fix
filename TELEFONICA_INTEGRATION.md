# Telefonica Mexico Integration

## Overview
This integration connects to Telefonica Mexico (Movistar) for mobile topup services using their SOAP/XML web service API.

## Provider Details
- **Provider Name**: Telefonica Mexico (Movistar)
- **Protocol**: SOAP 1.1 over HTTP/HTTPS
- **WSDL Endpoint**: `http://srm.movistar.com.mx/services/RecargaServicioPort?wsdl`
- **Supported Countries**: Mexico (MX)
- **Supported Services**: Mobile topups (traditional recharge and packet sales)

## Requirements

### Network Access
⚠️ **IMPORTANT**: The Telefonica API endpoint requires VPN access or whitelisted IP addresses. This integration will NOT work from public internet without proper network configuration.

### Environment Variables
Configure the following environment variables:

```bash
# Telefonica Mexico Provider (Movistar)
TELEFONICA_WSDL_URL=http://srm.movistar.com.mx/services/RecargaServicioPort?wsdl
TELEFONICA_PASSWORD_IVR=your_password_ivr_here
TELEFONICA_PUNTO_VENTA=your_distributor_id_here
TELEFONICA_DEFAULT_TYPE=00
```

### Credentials Required
- `PASSWORD_IVR`: Authentication password provided by Telefonica
- `PUNTO_VENTA`: Distributor ID (punto de venta) assigned by Telefonica

### Dependencies
- `axios`: For HTTP/SOAP requests (already installed)

## Implementation

### File Structure
```
providers/
├── telefonica-provider.js    # Main provider implementation
├── provider-router.js         # Updated to include Telefonica
└── index.js                   # Updated exports
```

### Transaction Types
The provider supports two transaction types:
- **00**: Traditional recharge (recarga tradicional)
- **03**: Packet sale (venta de paquetes)

Default: `00` (traditional recharge)

## Usage

### Direct Provider Access
```javascript
const { TelefonicaProvider } = require('./providers');

const provider = new TelefonicaProvider();

// Process topup
const result = await provider.topup({
    phone: '5512345678',      // 10-digit Mexico phone number
    amount: 20,               // Amount in MXN
    transactionType: '00',    // Optional: '00' or '03'
    country: 'MX'
});
```

### Via Provider Router (Recommended)
```javascript
const { router } = require('./providers');

// Router will automatically select Telefonica if other providers fail
const result = await router.processTopup({
    phone: '5512345678',
    amount: 20,
    country: 'MEXICO',
    preferredProvider: 'telefonica'  // Optional: force Telefonica
});
```

### API Endpoint Usage
```bash
# Via existing topup endpoint
POST /api/enviadespensa/topup
{
  "phone": "5512345678",
  "amount": 20,
  "country": "MEXICO",
  "preferredProvider": "telefonica"
}
```

## Response Format

### Success Response
```json
{
  "success": true,
  "provider": "Telefonica",
  "providerTransactionId": "AUTH123456",
  "message": "Top-up successful",
  "responseTime": 1234,
  "transactionId": "760314204744",
  "rawResponse": "<?xml version=\"1.0\"?>..."
}
```

### Error Response
```json
{
  "success": false,
  "provider": "Telefonica",
  "providerTransactionId": "AUTH123456",
  "message": "Transaction failed: Invalid phone number",
  "responseTime": 1234,
  "transactionId": "760314204744",
  "resultado": "ERROR"
}
```

## Testing

### Test Script
A test script is provided: `test-telefonica.js`

```bash
# Set environment variables first
export TELEFONICA_PASSWORD_IVR=your_password
export TELEFONICA_PUNTO_VENTA=your_distributor_id

# Run test
node test-telefonica.js
```

### Test Results on Mac (Without VPN)
```
✅ Provider configured correctly
✅ Code logic working properly
❌ Connection fails (ENOTFOUND) - Expected without VPN access
```

## Deployment

### Development (Mac)
- ✅ Code development completed
- ✅ Provider registered in router
- ✅ Environment variables documented
- ❌ Cannot test without VPN access

### Production (Windows Server with VPN)
**Next Steps**:
1. Transfer code to Windows server
2. Connect to VPN
3. Configure production credentials
4. Test connectivity to `srm.movistar.com.mx`
5. Run integration tests
6. Deploy to production

## Provider Routing

Telefonica is configured as the last fallback option for Mexico topups:
```
Mexico Topups: Latcom → PPN → MUWE → Telefonica
```

To use Telefonica as primary provider, update `provider-router.js`:
```javascript
mexico_topup: ['telefonica', 'latcom', 'ppn', 'muwe']
```

## Transaction Flow

1. **Request Validation**: Phone number format, amount validation
2. **SOAP Envelope Generation**: Build XML request with credentials
3. **API Call**: POST to WSDL endpoint with SOAP action
4. **Response Parsing**: Extract RESULTADO, NUM_AUTORIZACION, MENSAJE
5. **Result Mapping**: Map to standardized response format

## Error Codes

Common error messages from Telefonica API:
- `EXITO`: Transaction successful
- `ERROR`: Transaction failed
- `DN_INVALIDO`: Invalid phone number
- `MONTO_INVALIDO`: Invalid amount
- `SALDO_INSUFICIENTE`: Insufficient balance
- `SERVICIO_NO_DISPONIBLE`: Service unavailable
- `TIMEOUT`: Request timeout
- `AUTENTICACION_FALLIDA`: Authentication failed

## API Response Time
Expected response time: 0.1 to 5 seconds (per Telefonica documentation)

## Security Notes

1. **VPN Required**: Production endpoint requires VPN or IP whitelisting
2. **Credentials**: Store PASSWORD_IVR and PUNTO_VENTA securely
3. **HTTPS**: Consider using HTTPS endpoint in production if available
4. **Transaction IDs**: System generates unique 8-12 digit transaction IDs

## Support

### Documentation Files
All Telefonica API documentation is located in:
```
/Users/richardmas/Downloads/API Payments Telefonica/
```

Key files:
- `TFMX – Web Service Based Recharge Specification_020419.pdf` - SOAP API spec
- `Especificaciones_Genéricas_V5.3.pdf` - ISO 8583 POS integration spec

### Contact
For Telefonica API issues, contact your Telefonica representative or distributor account manager.

## Next Steps

### Immediate
- [x] Code implementation complete
- [x] Provider registered
- [x] Environment variables documented
- [x] Test script created
- [ ] Deploy to Windows server with VPN
- [ ] Configure production credentials
- [ ] Test with real transactions

### Future Enhancements
- [ ] Implement packet sale (type 03) support
- [ ] Add transaction status checking
- [ ] Implement reversal/refund functionality
- [ ] Add product catalog integration
- [ ] Monitor response times and implement caching
- [ ] Add retry logic for timeout scenarios

## Notes

- This provider only supports topups, not bill payments or vouchers
- Phone numbers are automatically cleaned (non-digits removed)
- Transaction IDs are auto-generated if not provided
- All amounts are in MXN (Mexican Pesos)
- SOAP requests use UTF-8 encoding
