# Relier API Integration Guide

**Client:** HAZ Group
**Document Version:** 1.0
**Date:** October 13, 2025
**Status:** Production Ready

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [API Endpoints](#api-endpoints)
4. [Request/Response Format](#requestresponse-format)
5. [Error Handling](#error-handling)
6. [Rate Limits & Security](#rate-limits--security)
7. [Testing Guide](#testing-guide)
8. [Code Examples](#code-examples)
9. [Support](#support)

---

## Overview

Relier provides a RESTful API for mobile airtime top-ups in Mexico. This document outlines the integration process for HAZ Group to connect to the Relier platform.

### API Features

- **Real-time top-ups** to major Mexican carriers (Telcel, Movistar, AT&T, Unefon, Virgin Mobile)
- **USD billing** with automatic MXN conversion at competitive exchange rates
- **Transaction tracking** with unique IDs for reconciliation
- **High availability** with 99.9% uptime SLA
- **Secure authentication** with API keys
- **Rate limiting** to prevent abuse

### Base URL

**Production:**
```
https://latcom-fix-production.up.railway.app
```

---

## Authentication

All API requests require authentication using HTTP headers.

### Required Headers

```http
Content-Type: application/json
x-api-key: haz_prod_2025
x-customer-id: HAZ_001
```

### Security Notes

- Keep your API credentials secure
- Never commit credentials to version control
- Use environment variables for credential storage
- Rotate keys periodically (contact support for key rotation)

---

## API Endpoints

### 1. Health Check

Check API availability and system status.

**Endpoint:** `GET /health`
**Authentication:** Not required

**Response:**
```json
{
  "status": "OK",
  "timestamp": "2025-10-13T10:00:00.000Z",
  "uptime": 86400,
  "mode": "PRODUCTION",
  "services": {
    "database": {
      "connected": true,
      "status": "healthy"
    },
    "redis": {
      "connected": true,
      "status": "healthy"
    }
  }
}
```

---

### 2. Check Balance

Retrieve your current account balance and credit limit.

**Endpoint:** `GET /api/balance`
**Authentication:** Required

**Request Example:**
```bash
curl -X GET https://latcom-fix-production.up.railway.app/api/balance \
  -H "x-api-key: haz_prod_2025" \
  -H "x-customer-id: HAZ_001"
```

**Response:**
```json
{
  "success": true,
  "customer_id": "HAZ_001",
  "company_name": "HAZ Group",
  "current_balance": 9998.92,
  "credit_limit": 10000,
  "currency": "USD"
}
```

---

### 3. Process Top-Up (Synchronous)

Process a mobile top-up and wait for the result.

**Endpoint:** `POST /api/enviadespensa/topup`
**Authentication:** Required
**Rate Limit:** 200 requests per minute

**Request Body:**
```json
{
  "phone": "5566374683",
  "amount": 20,
  "reference": "ORDER_12345"
}
```

**Field Descriptions:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| phone | string | Yes | 10-digit Mexican phone number (no country code) |
| amount | number | Yes | Top-up amount in MXN (10-500) |
| reference | string | No | Your internal order/reference ID for tracking |

**Available Amounts (MXN):**
```
10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 150, 200, 300, 500
```

**Request Example:**
```bash
curl -X POST https://latcom-fix-production.up.railway.app/api/enviadespensa/topup \
  -H "Content-Type: application/json" \
  -H "x-api-key: haz_prod_2025" \
  -H "x-customer-id: HAZ_001" \
  -d '{
    "phone": "5566374683",
    "amount": 20,
    "reference": "ORDER_12345"
  }'
```

**Success Response:**
```json
{
  "success": true,
  "transaction": {
    "id": "RLR1760353500123",
    "status": "SUCCESS",
    "amount_mxn": 20,
    "amount_usd": 1.08,
    "exchange_rate": 18.52,
    "phone": "5566374683",
    "reference": "ORDER_12345",
    "operatorTransactionId": "LT62599623",
    "provider": "relier",
    "processedAt": "2025-10-13T10:00:00Z",
    "currency": "MXN"
  },
  "billing": {
    "deducted_usd": 1.08,
    "balance_before_usd": 10000.00,
    "balance_after_usd": 9998.92,
    "exchange_rate": 18.52
  },
  "message": "Top-up of 20 MXN processed successfully. $1.08 USD deducted from balance.",
  "remaining_balance": 9998.92
}
```

---

### 4. Process Top-Up (Asynchronous)

Submit a top-up request for background processing. Recommended for high-volume operations.

**Endpoint:** `POST /api/enviadespensa/topup-async`
**Authentication:** Required
**Rate Limit:** 200 requests per minute

**Request Body:** (Same as synchronous)

**Response:**
```json
{
  "success": true,
  "transaction": {
    "id": "RLR1760353500456",
    "status": "PENDING",
    "amount": 20,
    "phone": "5566374683",
    "reference": "ORDER_12345",
    "queuedAt": "2025-10-13T10:00:00Z",
    "currency": "MXN"
  },
  "message": "Transaction queued for processing",
  "check_status_url": "/api/transaction/RLR1760353500456"
}
```

---

### 5. Check Transaction Status

Check the status of a specific transaction.

**Endpoint:** `GET /api/transaction/{transactionId}`
**Authentication:** Not required (transaction ID acts as token)

**Request Example:**
```bash
curl https://latcom-fix-production.up.railway.app/api/transaction/RLR1760353500123
```

**Response:**
```json
{
  "success": true,
  "transaction": {
    "transaction_id": "RLR1760353500123",
    "customer_id": "HAZ_001",
    "phone": "5566374683",
    "amount_mxn": 20,
    "amount_usd": 1.08,
    "exchange_rate": 18.52,
    "status": "SUCCESS",
    "reference": "ORDER_12345",
    "operator_transaction_id": "LT62599623",
    "provider": "relier",
    "response_time_ms": 2345,
    "created_at": "2025-10-13T10:00:00Z",
    "processed_at": "2025-10-13T10:00:02Z",
    "currency": "MXN"
  }
}
```

**Transaction Statuses:**
- `PENDING` - Transaction submitted, awaiting processing
- `SUCCESS` - Top-up completed successfully
- `FAILED` - Top-up failed (balance will not be deducted)

---

## Request/Response Format

### Request Requirements

1. **Content-Type:** All POST requests must use `Content-Type: application/json`
2. **Phone Format:** 10 digits, no spaces or special characters (e.g., `5566374683`)
3. **Amount:** Must be one of the allowed MXN amounts (10-500)
4. **Reference:** Optional but recommended for tracking

### Response Format

All responses follow this structure:

**Success:**
```json
{
  "success": true,
  "transaction": { ... },
  "billing": { ... },
  "message": "Descriptive success message"
}
```

**Error:**
```json
{
  "success": false,
  "error": "Error description",
  "details": { ... }
}
```

---

## Error Handling

### Common HTTP Status Codes

| Code | Meaning | Description |
|------|---------|-------------|
| 200 | OK | Request successful |
| 400 | Bad Request | Invalid request format or parameters |
| 401 | Unauthorized | Invalid or missing API credentials |
| 403 | Forbidden | Insufficient balance or IP not authorized |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | System error, contact support |
| 503 | Service Unavailable | System temporarily unavailable |

### Error Response Examples

**Invalid Credentials:**
```json
{
  "success": false,
  "error": "Invalid API credentials"
}
```

**Insufficient Balance:**
```json
{
  "success": false,
  "error": "Insufficient balance",
  "current_balance_usd": 5.00,
  "required_usd": 10.80
}
```

**Invalid Amount:**
```json
{
  "success": false,
  "error": "Invalid product amount",
  "message": "Only fixed amounts are allowed",
  "allowed_amounts": [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 150, 200, 300, 500],
  "requested_amount": 25
}
```

**Rate Limit Exceeded:**
```json
{
  "success": false,
  "error": "Too many topup requests. Maximum 200 per minute."
}
```

**Daily Limit Exceeded:**
```json
{
  "success": false,
  "error": "Daily transaction limit exceeded",
  "daily_limit_mxn": 5000,
  "used_today_mxn": 4800,
  "requested_mxn": 300,
  "available_mxn": 200
}
```

### Retry Logic

Implement exponential backoff for failed requests:

1. **Network errors:** Retry with backoff (1s, 2s, 4s)
2. **429 Rate Limit:** Wait 60 seconds before retry
3. **500/503 Errors:** Retry with backoff (5s, 10s, 30s)
4. **400/401/403 Errors:** Do not retry, fix the request

---

## Rate Limits & Security

### Rate Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| General API | 300 requests | 15 minutes |
| Top-up endpoints | 200 requests | 1 minute |

**Rate Limit Headers:**
```
X-RateLimit-Limit: 200
X-RateLimit-Remaining: 195
X-RateLimit-Reset: 1697193600
```

### Daily Transaction Limit

- **Maximum:** 5,000 MXN per 24-hour period
- Prevents excessive spending
- Resets automatically at midnight UTC

### Security Features

1. **API Key Authentication** - All requests validated
2. **HTTPS Only** - All traffic encrypted
3. **Rate Limiting** - Prevents abuse
4. **IP Whitelisting** - Optional (contact support to enable)
5. **Transaction Logging** - Full audit trail maintained

### Best Practices

- Store credentials in environment variables
- Use HTTPS for all requests
- Implement request timeouts (30 seconds recommended)
- Log all transactions for reconciliation
- Monitor your balance regularly
- Set up low-balance alerts

---

## Testing Guide

### Step 1: Verify API Access

```bash
curl https://latcom-fix-production.up.railway.app/health
```

Expected: `{"status":"OK",...}`

### Step 2: Check Your Balance

```bash
curl -X GET https://latcom-fix-production.up.railway.app/api/balance \
  -H "x-api-key: haz_prod_2025" \
  -H "x-customer-id: HAZ_001"
```

Expected: Current balance and credit limit

### Step 3: Test Small Top-Up

```bash
curl -X POST https://latcom-fix-production.up.railway.app/api/enviadespensa/topup \
  -H "Content-Type: application/json" \
  -H "x-api-key: haz_prod_2025" \
  -H "x-customer-id: HAZ_001" \
  -d '{
    "phone": "5566374683",
    "amount": 10,
    "reference": "TEST_001"
  }'
```

Expected: Success response with transaction details

### Step 4: Verify Transaction

```bash
curl https://latcom-fix-production.up.railway.app/api/transaction/RLR1760353500123
```

Replace transaction ID with the one from Step 3.

---

## Code Examples

### Node.js / JavaScript

```javascript
const axios = require('axios');

const RELIER_API_URL = 'https://latcom-fix-production.up.railway.app';
const API_KEY = 'haz_prod_2025';
const CUSTOMER_ID = 'HAZ_001';

async function processTopup(phone, amount, reference) {
  try {
    const response = await axios.post(
      `${RELIER_API_URL}/api/enviadespensa/topup`,
      {
        phone: phone,
        amount: amount,
        reference: reference
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_KEY,
          'x-customer-id': CUSTOMER_ID
        },
        timeout: 30000 // 30 seconds
      }
    );

    if (response.data.success) {
      console.log('Top-up successful!');
      console.log('Transaction ID:', response.data.transaction.id);
      console.log('Amount:', response.data.transaction.amount_mxn, 'MXN');
      console.log('Cost:', response.data.transaction.amount_usd, 'USD');
      console.log('Remaining balance:', response.data.remaining_balance, 'USD');
      return response.data;
    } else {
      console.error('Top-up failed:', response.data.error);
      return null;
    }
  } catch (error) {
    if (error.response) {
      console.error('API Error:', error.response.data.error);
      console.error('Status:', error.response.status);
    } else {
      console.error('Network Error:', error.message);
    }
    return null;
  }
}

// Check balance
async function checkBalance() {
  try {
    const response = await axios.get(
      `${RELIER_API_URL}/api/balance`,
      {
        headers: {
          'x-api-key': API_KEY,
          'x-customer-id': CUSTOMER_ID
        }
      }
    );

    console.log('Current Balance:', response.data.current_balance, 'USD');
    return response.data;
  } catch (error) {
    console.error('Balance check failed:', error.message);
    return null;
  }
}

// Usage
processTopup('5566374683', 20, 'ORDER_12345');
```

---

### Python

```python
import requests
import json

RELIER_API_URL = 'https://latcom-fix-production.up.railway.app'
API_KEY = 'haz_prod_2025'
CUSTOMER_ID = 'HAZ_001'

def process_topup(phone, amount, reference):
    """Process a mobile top-up"""
    headers = {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'x-customer-id': CUSTOMER_ID
    }

    payload = {
        'phone': phone,
        'amount': amount,
        'reference': reference
    }

    try:
        response = requests.post(
            f'{RELIER_API_URL}/api/enviadespensa/topup',
            headers=headers,
            json=payload,
            timeout=30
        )

        data = response.json()

        if data.get('success'):
            print(f"✅ Top-up successful!")
            print(f"Transaction ID: {data['transaction']['id']}")
            print(f"Amount: {data['transaction']['amount_mxn']} MXN")
            print(f"Cost: ${data['transaction']['amount_usd']} USD")
            print(f"Balance: ${data['remaining_balance']} USD")
            return data
        else:
            print(f"❌ Top-up failed: {data.get('error')}")
            return None

    except requests.exceptions.RequestException as e:
        print(f"❌ Request error: {str(e)}")
        return None

def check_balance():
    """Check account balance"""
    headers = {
        'x-api-key': API_KEY,
        'x-customer-id': CUSTOMER_ID
    }

    try:
        response = requests.get(
            f'{RELIER_API_URL}/api/balance',
            headers=headers,
            timeout=10
        )

        data = response.json()

        if data.get('success'):
            print(f"💰 Balance: ${data['current_balance']} USD")
            return data
        else:
            print(f"❌ Balance check failed: {data.get('error')}")
            return None

    except requests.exceptions.RequestException as e:
        print(f"❌ Request error: {str(e)}")
        return None

# Usage
if __name__ == '__main__':
    check_balance()
    process_topup('5566374683', 20, 'ORDER_12345')
```

---

### PHP

```php
<?php

define('RELIER_API_URL', 'https://latcom-fix-production.up.railway.app');
define('API_KEY', 'haz_prod_2025');
define('CUSTOMER_ID', 'HAZ_001');

function processTopup($phone, $amount, $reference) {
    $url = RELIER_API_URL . '/api/enviadespensa/topup';

    $data = [
        'phone' => $phone,
        'amount' => $amount,
        'reference' => $reference
    ];

    $headers = [
        'Content-Type: application/json',
        'x-api-key: ' . API_KEY,
        'x-customer-id: ' . CUSTOMER_ID
    ];

    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode === 200) {
        $result = json_decode($response, true);

        if ($result['success']) {
            echo "✅ Top-up successful!\n";
            echo "Transaction ID: {$result['transaction']['id']}\n";
            echo "Amount: {$result['transaction']['amount_mxn']} MXN\n";
            echo "Cost: \${$result['transaction']['amount_usd']} USD\n";
            echo "Balance: \${$result['remaining_balance']} USD\n";
            return $result;
        } else {
            echo "❌ Top-up failed: {$result['error']}\n";
            return null;
        }
    } else {
        echo "❌ HTTP Error: $httpCode\n";
        return null;
    }
}

function checkBalance() {
    $url = RELIER_API_URL . '/api/balance';

    $headers = [
        'x-api-key: ' . API_KEY,
        'x-customer-id: ' . CUSTOMER_ID
    ];

    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode === 200) {
        $result = json_decode($response, true);
        echo "💰 Balance: \${$result['current_balance']} USD\n";
        return $result;
    } else {
        echo "❌ Balance check failed\n";
        return null;
    }
}

// Usage
checkBalance();
processTopup('5566374683', 20, 'ORDER_12345');

?>
```

---

### Java

```java
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import org.json.JSONObject;

public class RelierAPI {
    private static final String RELIER_API_URL = "https://latcom-fix-production.up.railway.app";
    private static final String API_KEY = "haz_prod_2025";
    private static final String CUSTOMER_ID = "HAZ_001";

    private static final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(30))
            .build();

    public static JSONObject processTopup(String phone, int amount, String reference) {
        try {
            JSONObject payload = new JSONObject();
            payload.put("phone", phone);
            payload.put("amount", amount);
            payload.put("reference", reference);

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(RELIER_API_URL + "/api/enviadespensa/topup"))
                    .header("Content-Type", "application/json")
                    .header("x-api-key", API_KEY)
                    .header("x-customer-id", CUSTOMER_ID)
                    .POST(HttpRequest.BodyPublishers.ofString(payload.toString()))
                    .timeout(Duration.ofSeconds(30))
                    .build();

            HttpResponse<String> response = httpClient.send(request,
                    HttpResponse.BodyHandlers.ofString());

            JSONObject result = new JSONObject(response.body());

            if (result.getBoolean("success")) {
                System.out.println("✅ Top-up successful!");
                JSONObject transaction = result.getJSONObject("transaction");
                System.out.println("Transaction ID: " + transaction.getString("id"));
                System.out.println("Amount: " + transaction.getDouble("amount_mxn") + " MXN");
                System.out.println("Cost: $" + transaction.getDouble("amount_usd") + " USD");
                System.out.println("Balance: $" + result.getDouble("remaining_balance") + " USD");
                return result;
            } else {
                System.out.println("❌ Top-up failed: " + result.getString("error"));
                return null;
            }

        } catch (Exception e) {
            System.out.println("❌ Error: " + e.getMessage());
            return null;
        }
    }

    public static JSONObject checkBalance() {
        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(RELIER_API_URL + "/api/balance"))
                    .header("x-api-key", API_KEY)
                    .header("x-customer-id", CUSTOMER_ID)
                    .GET()
                    .timeout(Duration.ofSeconds(10))
                    .build();

            HttpResponse<String> response = httpClient.send(request,
                    HttpResponse.BodyHandlers.ofString());

            JSONObject result = new JSONObject(response.body());

            if (result.getBoolean("success")) {
                System.out.println("💰 Balance: $" + result.getDouble("current_balance") + " USD");
                return result;
            } else {
                System.out.println("❌ Balance check failed");
                return null;
            }

        } catch (Exception e) {
            System.out.println("❌ Error: " + e.getMessage());
            return null;
        }
    }

    public static void main(String[] args) {
        checkBalance();
        processTopup("5566374683", 20, "ORDER_12345");
    }
}
```

---

## Support

### Technical Support

For technical assistance, integration support, or API questions:

- **Email:** support@relier.com
- **Response Time:** Within 24 hours
- **Emergency Support:** Available for production issues

### Account Management

For billing, balance top-ups, or account inquiries:

- **Email:** accounts@relier.com
- **Balance Alerts:** Automatic notifications at $1,000 USD threshold

### System Status

Monitor system health and uptime:
- **Status Page:** https://latcom-fix-production.up.railway.app/health
- **Uptime SLA:** 99.9%

### Documentation Updates

This document is version controlled. Check for updates regularly or contact support for the latest version.

---

## Appendix

### Supported Carriers

- Telcel
- Movistar / Telefonica
- AT&T Mexico
- Unefon
- Virgin Mobile Mexico

### Available Denominations (MXN)

| Amount | Approx. USD* |
|--------|-------------|
| 10     | ~$0.54      |
| 20     | ~$1.08      |
| 30     | ~$1.62      |
| 40     | ~$2.16      |
| 50     | ~$2.70      |
| 60     | ~$3.24      |
| 70     | ~$3.78      |
| 80     | ~$4.32      |
| 90     | ~$4.86      |
| 100    | ~$5.40      |
| 150    | ~$8.10      |
| 200    | ~$10.80     |
| 300    | ~$16.20     |
| 500    | ~$27.00     |

*USD costs are approximate and based on real-time exchange rates (≈18.5 MXN/USD)

### Exchange Rate Information

- Exchange rates are updated in real-time
- Rates are competitive and transparent
- Full forex details included in every transaction response
- Historical rates available through transaction logs

### Reconciliation

- Transaction logs available via admin dashboard
- CSV export functionality for accounting
- Daily/monthly reports available on request
- All transactions include unique IDs for tracking

---

**Document End**

*For questions about this document or the Relier API, please contact HAZ Group's account manager or technical support.*

**Last Updated:** October 13, 2025
**Document Version:** 1.0
**API Version:** v1
