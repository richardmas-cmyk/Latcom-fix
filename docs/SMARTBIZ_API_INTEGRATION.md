# SmartBiz Telecom API Integration Guide
## Mobile Topups via Relier Group

**Generated:** October 14, 2025
**Customer:** SmartBiz Telecom
**Version:** 2.0

---

## 🔐 API Credentials

```
Customer ID: SMARTBIZ_001
Company Name: SmartBiz Telecom
API Key: smartbiz_prod_7d086ce74101615476169835689efbcd
Secret Key: SBT_545970e108537acd351c88ef1d8f572e52c6422058204102

Base URL (Production): https://latcom-fix-production.up.railway.app
```

**⚠️ IMPORTANT:** Keep these credentials secure. Never commit them to public repositories.

---

## 📋 Account Details

- **Credit Limit:** $200 USD (Testing)
- **Starting Balance:** $200 USD
- **Commission Rate:** 0% (can be adjusted)
- **Currency:** Transactions in MXN, balance in USD
- **Daily Limit:** 200,000 MXN per end-user per day (~$10,000 USD)
- **Rate Limit:** 200 requests per minute

**Note:** This is a testing account with a $200 limit. Once ready for production, the credit limit will be increased to support $300,000 USD monthly volume.

---

## 🎯 What You Can Do

### Available Services:

**Mobile Topups for Mexico**
- All Mexican carriers (Telcel, Movistar, AT&T, Unefon, etc.)
- Amounts: 10-500 MXN
- Processing time: 2-10 seconds
- High success rate with automatic retry logic

### Supported Carriers:
- ✅ **Telcel** - Mexico's largest carrier
- ✅ **Movistar** - Telefonica Mexico
- ✅ **AT&T Mexico** - Available in select regions
- ✅ **Unefon** - Telcel subsidiary
- ✅ **Virgin Mobile** - Available

---

## 🚀 Quick Start

### 1. Test Connection

```bash
curl https://latcom-fix-production.up.railway.app/health
```

### 2. Check Your Balance

```bash
curl https://latcom-fix-production.up.railway.app/api/balance \
  -H "x-api-key: smartbiz_prod_7d086ce74101615476169835689efbcd" \
  -H "x-customer-id: SMARTBIZ_001"
```

**Response:**
```json
{
  "success": true,
  "customer_id": "SMARTBIZ_001",
  "company_name": "SmartBiz Telecom",
  "current_balance": 200,
  "credit_limit": 200,
  "currency": "USD"
}
```

### 3. Perform a Test Topup

```bash
curl -X POST https://latcom-fix-production.up.railway.app/api/enviadespensa/topup \
  -H "Content-Type: application/json" \
  -H "x-api-key: smartbiz_prod_7d086ce74101615476169835689efbcd" \
  -H "x-customer-id: SMARTBIZ_001" \
  -d '{
    "phone": "5512345678",
    "amount": 20,
    "reference": "TEST-001"
  }'
```

---

## 📡 API Endpoints

### 1. Topup (Synchronous)

Process a mobile topup and wait for result.

**Endpoint:** `POST /api/enviadespensa/topup`

**Headers:**
```
Content-Type: application/json
x-api-key: smartbiz_prod_7d086ce74101615476169835689efbcd
x-customer-id: SMARTBIZ_001
```

**Request Body:**
```json
{
  "phone": "5512345678",
  "amount": 50,
  "reference": "ORDER-12345"
}
```

**Parameters:**
- `phone` (required): 10-digit Mexican phone number (no country code)
- `amount` (required): Amount in MXN (10-500)
- `reference` (optional): Your order reference

**Success Response (200):**
```json
{
  "success": true,
  "transaction": {
    "id": "RLR1697234567890",
    "status": "SUCCESS",
    "amount_mxn": 50,
    "amount_usd": 2.94,
    "exchange_rate": 17.0068,
    "phone": "5512345678",
    "reference": "ORDER-12345",
    "operatorTransactionId": "RLR789456123",
    "processedAt": "2025-10-14T10:30:00.000Z",
    "currency": "MXN"
  },
  "billing": {
    "deducted_usd": 2.94,
    "balance_before_usd": 200,
    "balance_after_usd": 197.06,
    "exchange_rate": 17.0068
  },
  "message": "Top-up of 50 MXN processed successfully. $2.94 USD deducted from balance.",
  "remaining_balance": 197.06
}
```

**Error Response (403 - Insufficient Balance):**
```json
{
  "success": false,
  "error": "Insufficient balance",
  "current_balance_usd": 10.50,
  "requested_mxn": 50,
  "required_usd": 2.94,
  "exchange_rate": 17.0068
}
```

**Error Response (429 - Rate Limit):**
```json
{
  "success": false,
  "error": "Daily transaction limit exceeded",
  "daily_limit_mxn": 200000,
  "used_today_mxn": 199950,
  "requested_mxn": 100,
  "available_mxn": 50
}
```

**Error Response (500 - Processing Failed):**
```json
{
  "success": false,
  "error": "Transaction processing failed",
  "response_time_ms": 3421
}
```

---

### 2. Topup (Asynchronous) - For High Volume

Process topup asynchronously via queue system. Returns immediately.

**Endpoint:** `POST /api/enviadespensa/topup-async`

**Headers:** Same as synchronous

**Request Body:** Same as synchronous

**Success Response (200):**
```json
{
  "success": true,
  "transaction": {
    "id": "RLR1697234567890",
    "status": "PENDING",
    "amount": 50,
    "phone": "5512345678",
    "reference": "ORDER-12345",
    "queuedAt": "2025-10-14T10:30:00.000Z",
    "currency": "MXN"
  },
  "message": "Transaction queued for processing",
  "check_status_url": "/api/transaction/RLR1697234567890"
}
```

Then poll for status using transaction ID.

---

### 3. Check Transaction Status

**Endpoint:** `GET /api/transaction/{transactionId}`

**Headers:**
```
x-api-key: smartbiz_prod_7d086ce74101615476169835689efbcd
x-customer-id: SMARTBIZ_001
```

**Response:**
```json
{
  "success": true,
  "transaction": {
    "id": "RLR1697234567890",
    "transaction_id": "RLR1697234567890",
    "customer_id": "SMARTBIZ_001",
    "phone": "5512345678",
    "amount": 2.94,
    "amount_mxn": 50,
    "amount_usd": 2.94,
    "exchange_rate": 17.0068,
    "status": "SUCCESS",
    "reference": "ORDER-12345",
    "operator_transaction_id": "RLR789456123",
    "response_time_ms": 3241,
    "created_at": "2025-10-14T10:30:00.000Z",
    "processed_at": "2025-10-14T10:30:03.241Z"
  }
}
```

---

### 4. Check Balance

**Endpoint:** `GET /api/balance`

**Headers:**
```
x-api-key: smartbiz_prod_7d086ce74101615476169835689efbcd
x-customer-id: SMARTBIZ_001
```

**Response:**
```json
{
  "success": true,
  "customer_id": "SMARTBIZ_001",
  "company_name": "SmartBiz Telecom",
  "current_balance": 197.06,
  "credit_limit": 200,
  "currency": "USD"
}
```

---

## 🔄 Forex Conversion

All transactions are in **MXN** but your balance is in **USD**.

### How It Works:

1. You request topup: **50 MXN**
2. System gets real-time exchange rate: **1 USD = 17.0068 MXN**
3. Calculates USD cost: **50 ÷ 17.0068 = $2.94 USD**
4. Deducts **$2.94 USD** from your balance
5. Processes **50 MXN** topup

**Exchange Rate Source:** Real-time rates refreshed every 6 hours

---

## 📊 Rate Limits

| Limit Type | Value |
|------------|-------|
| **API Requests** | 300 per 15 minutes |
| **Topup Requests** | 200 per minute per customer |
| **Daily Transaction Volume** | 200,000 MXN per end-user (~$10,000 USD) |
| **Single Transaction** | 10-500 MXN |

**Note:** Daily limit is per end-user phone number, not per SmartBiz account. This supports ~$300,000 USD monthly volume.

---

## 🛠️ Testing

### Test Phone Numbers

For development, use test numbers:
- `5500000000` - Always succeeds (test mode)
- `5500000001` - Always fails (for error handling)
- `5512345678` - Real test (charges account)

### Test Amounts

- **10 MXN** - Minimum amount
- **20 MXN** - Common test amount
- **500 MXN** - Maximum amount

### Sandbox Environment

Contact us if you need a sandbox environment with test credentials.

---

## 🚨 Error Handling

### Common Error Codes

| HTTP Code | Error | Meaning |
|-----------|-------|---------|
| 200 | `success: true` | Transaction successful |
| 400 | `Validation failed` | Invalid phone/amount format |
| 401 | `Invalid API credentials` | Wrong API key or customer ID |
| 403 | `Insufficient balance` | Not enough USD balance |
| 429 | `Too many requests` | Rate limit exceeded |
| 429 | `Daily transaction limit exceeded` | User daily limit reached |
| 500 | `Transaction processing failed` | System error |

### Retry Logic

**Recommended retry strategy:**

```javascript
async function topupWithRetry(phone, amount, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await performTopup(phone, amount);
      if (result.success) return result;

      // Don't retry on balance/validation errors
      if (result.status === 403 || result.status === 400) {
        throw new Error(result.error);
      }

      // Wait before retry (exponential backoff)
      await sleep(1000 * attempt);

    } catch (error) {
      if (attempt === maxRetries) throw error;
    }
  }
}
```

**Do NOT retry on:**
- 401 (Invalid credentials)
- 403 (Insufficient balance)
- 400 (Validation errors)
- 429 (Rate limit)

**DO retry on:**
- 500 (Processing failures)
- Network timeouts
- Connection errors

---

## 🔔 Webhooks (Optional)

If you want real-time notifications, we can configure webhooks for:
- Transaction success
- Transaction failure
- Low balance alerts

Contact us to set up webhook URLs.

---

## 📈 Monitoring Dashboard

Access your dashboard at:
```
https://latcom-fix-production.up.railway.app/dashboard
```

**Login with your API credentials:**
- API Key: `smartbiz_prod_7d086ce74101615476169835689efbcd`
- Customer ID: `SMARTBIZ_001`

**Dashboard Features:**
- Real-time balance
- Transaction history
- Success/failure rates
- Daily volume charts
- Performance metrics

---

## 💰 Billing & Invoicing

### How Billing Works:

1. **Pre-paid Model:** Your balance is deducted in real-time
2. **Currency:** Balance in USD, transactions in MXN
3. **Exchange Rate:** Real-time rates (updated every 6 hours)
4. **Commission:** 0% (can be adjusted per agreement)

### Top-Up Your Balance:

Contact us to add credit:
- **Email:** richardmas@gmail.com
- **Minimum Top-Up:** $1,000 USD
- **Payment Methods:** Wire transfer, SPEI

### Monthly Invoices:

We generate monthly invoices with:
- All transactions
- Total MXN processed
- Total USD deducted
- Average exchange rate
- Commission (if applicable)

---

## 🔐 Security Best Practices

### 1. Keep Credentials Secure
```javascript
// ✅ Good - Use environment variables
const API_KEY = process.env.SMARTBIZ_API_KEY;

// ❌ Bad - Hard-coded credentials
const API_KEY = "smartbiz_prod_7d086ce74101615476169835689efbcd";
```

### 2. Use HTTPS Only
All API calls MUST use `https://` - never `http://`

### 3. Validate Responses
Always check `success` field before processing:
```javascript
if (response.success && response.transaction.status === 'SUCCESS') {
  // Process successful topup
} else {
  // Handle error
}
```

### 4. Store Transaction IDs
Always save our `transaction_id` for reconciliation:
```javascript
await db.saveTransaction({
  our_order_id: "ORDER-12345",
  relier_transaction_id: response.transaction.id,
  status: response.transaction.status,
  amount_mxn: response.transaction.amount_mxn,
  amount_usd: response.transaction.amount_usd
});
```

---

## 📞 Support

### Technical Support:
- **Email:** richardmas@gmail.com
- **Company:** Relier Group
- **Response Time:** Within 24 hours
- **Emergency:** Include "URGENT" in subject

### API Status:
- Check health: `GET /health`
- Current status: https://latcom-fix-production.up.railway.app/health

---

## 📄 Code Examples

### Node.js Example

```javascript
const axios = require('axios');

const RELIER_API = {
  baseURL: 'https://latcom-fix-production.up.railway.app',
  apiKey: 'smartbiz_prod_7d086ce74101615476169835689efbcd',
  customerId: 'SMARTBIZ_001'
};

async function performTopup(phone, amount, reference) {
  try {
    const response = await axios.post(
      `${RELIER_API.baseURL}/api/enviadespensa/topup`,
      {
        phone: phone,
        amount: amount,
        reference: reference
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': RELIER_API.apiKey,
          'x-customer-id': RELIER_API.customerId
        },
        timeout: 30000 // 30 second timeout
      }
    );

    if (response.data.success) {
      console.log('✅ Topup successful:', response.data.transaction.id);
      return {
        success: true,
        transactionId: response.data.transaction.id,
        operatorId: response.data.transaction.operatorTransactionId,
        amountMXN: response.data.transaction.amount_mxn,
        amountUSD: response.data.transaction.amount_usd
      };
    } else {
      console.error('❌ Topup failed:', response.data.error);
      return {
        success: false,
        error: response.data.error
      };
    }

  } catch (error) {
    console.error('❌ API Error:', error.message);

    if (error.response) {
      // Server responded with error
      return {
        success: false,
        error: error.response.data.error || 'Unknown error',
        statusCode: error.response.status
      };
    } else if (error.request) {
      // No response received
      return {
        success: false,
        error: 'Network error - no response from server'
      };
    } else {
      // Request setup error
      return {
        success: false,
        error: error.message
      };
    }
  }
}

async function checkBalance() {
  try {
    const response = await axios.get(
      `${RELIER_API.baseURL}/api/balance`,
      {
        headers: {
          'x-api-key': RELIER_API.apiKey,
          'x-customer-id': RELIER_API.customerId
        }
      }
    );

    console.log('💰 Current Balance:', response.data.current_balance, 'USD');
    return response.data.current_balance;

  } catch (error) {
    console.error('❌ Balance check error:', error.message);
    return null;
  }
}

// Example usage
async function main() {
  // Check balance first
  const balance = await checkBalance();

  if (balance && balance > 10) {
    // Perform topup
    const result = await performTopup(
      '5512345678',
      50,
      'ORDER-' + Date.now()
    );

    if (result.success) {
      console.log('Transaction ID:', result.transactionId);
      console.log('Cost:', result.amountUSD, 'USD');
    }
  } else {
    console.log('⚠️  Insufficient balance - please contact support');
  }
}

main();
```

### PHP Example

```php
<?php

class RelierAPI {
    private $baseURL = 'https://latcom-fix-production.up.railway.app';
    private $apiKey = 'smartbiz_prod_7d086ce74101615476169835689efbcd';
    private $customerId = 'SMARTBIZ_001';

    public function performTopup($phone, $amount, $reference) {
        $url = $this->baseURL . '/api/enviadespensa/topup';

        $data = json_encode([
            'phone' => $phone,
            'amount' => $amount,
            'reference' => $reference
        ]);

        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $data);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json',
            'x-api-key: ' . $this->apiKey,
            'x-customer-id: ' . $this->customerId
        ]);
        curl_setopt($ch, CURLOPT_TIMEOUT, 30);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        $result = json_decode($response, true);

        if ($httpCode === 200 && $result['success']) {
            return [
                'success' => true,
                'transactionId' => $result['transaction']['id'],
                'operatorId' => $result['transaction']['operatorTransactionId'],
                'amountMXN' => $result['transaction']['amount_mxn'],
                'amountUSD' => $result['transaction']['amount_usd']
            ];
        } else {
            return [
                'success' => false,
                'error' => $result['error'] ?? 'Unknown error',
                'httpCode' => $httpCode
            ];
        }
    }

    public function checkBalance() {
        $url = $this->baseURL . '/api/balance';

        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'x-api-key: ' . $this->apiKey,
            'x-customer-id: ' . $this->customerId
        ]);

        $response = curl_exec($ch);
        curl_close($ch);

        $result = json_decode($response, true);

        return $result['success'] ? $result['current_balance'] : null;
    }
}

// Example usage
$api = new RelierAPI();

// Check balance
$balance = $api->checkBalance();
echo "Current Balance: $" . $balance . " USD\n";

// Perform topup
$result = $api->performTopup('5512345678', 50, 'ORDER-' . time());

if ($result['success']) {
    echo "✅ Topup successful!\n";
    echo "Transaction ID: " . $result['transactionId'] . "\n";
    echo "Cost: $" . $result['amountUSD'] . " USD\n";
} else {
    echo "❌ Topup failed: " . $result['error'] . "\n";
}
?>
```

### Python Example

```python
import requests
import time

class RelierAPI:
    def __init__(self):
        self.base_url = 'https://latcom-fix-production.up.railway.app'
        self.api_key = 'smartbiz_prod_7d086ce74101615476169835689efbcd'
        self.customer_id = 'SMARTBIZ_001'

    def perform_topup(self, phone, amount, reference):
        url = f'{self.base_url}/api/enviadespensa/topup'

        headers = {
            'Content-Type': 'application/json',
            'x-api-key': self.api_key,
            'x-customer-id': self.customer_id
        }

        data = {
            'phone': phone,
            'amount': amount,
            'reference': reference
        }

        try:
            response = requests.post(url, json=data, headers=headers, timeout=30)
            result = response.json()

            if response.status_code == 200 and result.get('success'):
                return {
                    'success': True,
                    'transaction_id': result['transaction']['id'],
                    'operator_id': result['transaction']['operatorTransactionId'],
                    'amount_mxn': result['transaction']['amount_mxn'],
                    'amount_usd': result['transaction']['amount_usd']
                }
            else:
                return {
                    'success': False,
                    'error': result.get('error', 'Unknown error'),
                    'status_code': response.status_code
                }

        except requests.exceptions.RequestException as e:
            return {
                'success': False,
                'error': str(e)
            }

    def check_balance(self):
        url = f'{self.base_url}/api/balance'

        headers = {
            'x-api-key': self.api_key,
            'x-customer-id': self.customer_id
        }

        try:
            response = requests.get(url, headers=headers)
            result = response.json()

            if result.get('success'):
                return result['current_balance']
            else:
                return None

        except requests.exceptions.RequestException as e:
            print(f'Balance check error: {e}')
            return None

# Example usage
if __name__ == '__main__':
    api = RelierAPI()

    # Check balance
    balance = api.check_balance()
    print(f'Current Balance: ${balance} USD')

    # Perform topup
    result = api.perform_topup('5512345678', 50, f'ORDER-{int(time.time())}')

    if result['success']:
        print('✅ Topup successful!')
        print(f"Transaction ID: {result['transaction_id']}")
        print(f"Cost: ${result['amount_usd']} USD")
    else:
        print(f"❌ Topup failed: {result['error']}")
```

---

## 🔍 Reconciliation

### Get Your Transaction History

Access the reconciliation portal:
```
https://latcom-fix-production.up.railway.app/reconcile
```

**Login:**
- API Key: `smartbiz_prod_7d086ce74101615476169835689efbcd`
- Customer ID: `SMARTBIZ_001`

### Export CSV

Download transaction data for accounting:

```bash
curl "https://latcom-fix-production.up.railway.app/api/admin/reconcile/export?date_from=2025-10-01&date_to=2025-10-31" \
  -H "x-reconcile-key: <YOUR_RECONCILE_KEY>" \
  -o transactions_october.csv
```

---

## 📝 Changelog

### Version 2.0 (October 15, 2025)
- Rebranded to Relier Group
- Simplified documentation
- Removed internal provider references
- Enhanced reliability with automatic retry logic

### Version 1.0 (October 14, 2025)
- Initial API credentials generated for SmartBiz Telecom
- Multi-carrier support enabled
- Automatic failover configured
- Forex conversion (MXN/USD)
- Rate limiting configured
- Dashboard access enabled

---

## ✅ Next Steps

1. **Save your credentials** securely
2. **Test the API** with small amounts (10-20 MXN)
3. **Integrate** into your system using code examples above
4. **Monitor** via dashboard
5. **Contact us** when ready for production volume

---

**Questions?** Contact: richardmas@gmail.com
**Company:** Relier Group
**API Status:** https://latcom-fix-production.up.railway.app/health
