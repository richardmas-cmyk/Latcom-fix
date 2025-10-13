# 📱 Twilio Integration Setup Guide

Complete guide to integrate Twilio SMS and WhatsApp messaging into Relier Hub.

---

## 📋 Table of Contents
1. [Twilio Account Setup](#twilio-account-setup)
2. [Get Credentials](#get-credentials)
3. [Configure Railway](#configure-railway)
4. [SMS Setup](#sms-setup)
5. [WhatsApp Setup](#whatsapp-setup)
6. [Webhook Configuration](#webhook-configuration)
7. [Testing](#testing)
8. [Features & Use Cases](#features--use-cases)

---

## 🎯 Twilio Account Setup

### Step 1: Create Twilio Account
1. Go to https://www.twilio.com/
2. Click **"Sign up"**
3. Complete registration
4. Verify your email and phone number

### Step 2: Upgrade Account (Required for Production)
- **Free Trial:** Can only send to verified numbers
- **Paid Account:** Can send to any number
- Cost: ~$0.0075 per SMS, ~$0.005 per WhatsApp message

---

## 🔑 Get Credentials

### 1. Account SID and Auth Token

Go to Twilio Console: https://console.twilio.com/

You'll see:
```
ACCOUNT SID: ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
AUTH TOKEN: [Click to reveal]
```

**Save these values!**

### 2. Get Phone Number

**For SMS:**
1. Go to: https://console.twilio.com/us1/develop/phone-numbers/manage/incoming
2. Click **"Buy a number"**
3. Select country (e.g., United States)
4. Choose a number with **SMS** capability
5. Purchase number (~$1/month)

**For WhatsApp (Sandbox - Free for testing):**
1. Go to: https://console.twilio.com/us1/develop/sms/try-it-out/whatsapp-learn
2. Follow instructions to join sandbox
3. Your WhatsApp number: `whatsapp:+14155238886` (Twilio sandbox)

---

## ⚙️ Configure Railway

Add these environment variables to Railway:

```bash
railway variables --set "TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
railway variables --set "TWILIO_AUTH_TOKEN=your_auth_token_here"
railway variables --set "TWILIO_PHONE_NUMBER=+15551234567"
railway variables --set "TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886"
```

**Or add via Railway Dashboard:**
1. Go to Railway dashboard
2. Select your project
3. Go to Variables tab
4. Add each variable

---

## 📱 SMS Setup

### Enable SMS on Your Twilio Number

1. Go to: https://console.twilio.com/us1/develop/phone-numbers/manage/incoming
2. Click on your phone number
3. Under **Messaging Configuration:**
   - Configure with: **Webhooks**
   - A MESSAGE COMES IN: **Webhook**
   - URL: `https://latcom-fix-production.up.railway.app/webhook/twilio/sms`
   - HTTP Method: **POST**

4. Under **Status Callback URL:**
   - URL: `https://latcom-fix-production.up.railway.app/webhook/twilio/status`
   - HTTP Method: **POST**

5. Click **Save**

---

## 💬 WhatsApp Setup

### Option 1: Sandbox (Testing - Free)

1. Go to: https://console.twilio.com/us1/develop/sms/try-it-out/whatsapp-learn
2. Send "join [your-sandbox-name]" to **+1 415 523 8886** from WhatsApp
3. Configure webhook:
   - WHEN A MESSAGE COMES IN: `https://latcom-fix-production.up.railway.app/webhook/twilio/whatsapp`
   - HTTP Method: **POST**

**Limitations:**
- Must join sandbox first (send "join" message)
- Can only send to numbers that joined your sandbox
- Good for testing only

### Option 2: Production WhatsApp (Requires Business Account)

1. Apply for WhatsApp Business API access in Twilio Console
2. Verify your business
3. Get approved (takes 1-3 days)
4. Get your dedicated WhatsApp number
5. Configure webhooks same as sandbox

**Benefits:**
- Send to any WhatsApp number
- No "join" requirement
- Business verified checkmark
- Higher message limits

---

## 🔔 Webhook Configuration

### Webhook URLs

Configure these in your Twilio Console:

| Webhook Type | URL | Purpose |
|--------------|-----|---------|
| SMS Incoming | `/webhook/twilio/sms` | Receive SMS messages |
| WhatsApp Incoming | `/webhook/twilio/whatsapp` | Receive WhatsApp messages |
| Status Callback | `/webhook/twilio/status` | Track message delivery |

**Full URLs:**
```
https://latcom-fix-production.up.railway.app/webhook/twilio/sms
https://latcom-fix-production.up.railway.app/webhook/twilio/whatsapp
https://latcom-fix-production.up.railway.app/webhook/twilio/status
```

---

## 🧪 Testing

### Test SMS via API

```bash
curl -X POST https://latcom-fix-production.up.railway.app/api/twilio/test \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+15551234567",
    "message": "Test SMS from Relier Hub!",
    "channel": "sms"
  }'
```

### Test WhatsApp via API

```bash
curl -X POST https://latcom-fix-production.up.railway.app/api/twilio/test \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+15551234567",
    "message": "Test WhatsApp from Relier Hub!",
    "channel": "whatsapp"
  }'
```

### Test Transaction Notification

```javascript
const twilioService = require('./lib/twilio-service');

// Send SMS + WhatsApp notification
await twilioService.sendTransactionNotification({
    phone: '+15551234567',
    amount: 50,
    currency: 'MXN',
    status: 'SUCCESS',
    operatorTransactionId: 'TX123456',
    provider: 'Latcom'
}, ['sms', 'whatsapp']);
```

### Test Auto-Reply

Send any of these messages to your Twilio number:

- **"BALANCE"** → Get balance check info
- **"HELP"** → Show available commands
- **"SUPPORT"** → Get support contact

---

## 🎯 Features & Use Cases

### 1. Transaction Notifications

**Automatically send SMS/WhatsApp when:**
- Transaction is successful ✅
- Transaction fails ❌
- Transaction is pending ⏳

**Example Integration:**
```javascript
// In your topup endpoint, after processing:
if (dbConnected) {
    // Save to database...

    // Send notification
    await twilioService.sendTransactionNotification({
        phone: transaction.phone,
        amount: transaction.amount,
        status: result.success ? 'SUCCESS' : 'FAILED',
        operatorTransactionId: result.providerTransactionId,
        provider: 'Latcom'
    }, ['sms']); // or ['sms', 'whatsapp']
}
```

### 2. Balance Alerts

**Notify customers when balance is low:**

```javascript
const twilioService = require('./lib/twilio-service');

if (customer.balance < 100) {
    await twilioService.sendBalanceAlert(
        customer,
        customer.balance,
        100 // threshold
    );
}
```

### 3. OTP/Verification Codes

**2FA for secure login:**

```javascript
const code = Math.floor(100000 + Math.random() * 900000);

await twilioService.sendVerificationCode(
    customer.phone,
    code
);
```

### 4. Daily Summaries

**Send end-of-day reports:**

```javascript
await twilioService.sendDailySummary(customer, {
    count: 45,
    total: 2250,
    successful: 43,
    failed: 2,
    balance: 1575.50
});
```

### 5. Invoice Notifications

**Alert when invoices are generated:**

```javascript
await twilioService.sendInvoiceNotification(customer, {
    invoice_number: 'INV-2025-001',
    period_start: '2025-10-01',
    period_end: '2025-10-31',
    total_amount: 2500,
    transaction_count: 125
});
```

### 6. Welcome Messages

**Greet new customers:**

```javascript
await twilioService.sendWelcomeMessage({
    customer_id: 'CUST_001',
    company_name: 'New Customer Inc',
    phone: '+15551234567'
});
```

### 7. Auto-Replies

**Incoming messages get automatic responses:**

- Customer sends: "BALANCE" → Bot replies with balance check info
- Customer sends: "HELP" → Bot replies with available commands
- Customer sends: "SUPPORT" → Bot replies with support contact

---

## 💰 Cost Estimation

### SMS Pricing
- **Outbound SMS:** ~$0.0075 per message (US)
- **Inbound SMS:** ~$0.0075 per message (US)
- **Phone Number:** ~$1.00/month

### WhatsApp Pricing
- **Outbound (Business-initiated):** ~$0.005-0.02 per message
- **Inbound:** FREE
- **No phone number cost** (uses your existing WhatsApp Business)

### Example Monthly Cost (1000 transactions)
- 1000 transaction notifications (SMS): **$7.50**
- 50 balance alerts: **$0.38**
- 30 daily summaries: **$0.23**
- Phone number: **$1.00**
- **Total: ~$9.11/month**

**WhatsApp is cheaper!**
- 1000 WhatsApp notifications: **$5.00-20.00**
- No phone number cost

---

## 🔐 Security Best Practices

### 1. Keep Credentials Secret
- Never commit `.env` file
- Use Railway environment variables
- Rotate tokens regularly

### 2. Validate Webhooks
```javascript
const isValid = twilioService.validateWebhook(
    req.headers['x-twilio-signature'],
    req.url,
    req.body
);
```

### 3. Rate Limiting
Already configured in server.js:
- 100 API requests per 15 minutes
- 10 topups per minute per customer

### 4. Message Content
- Don't send sensitive data (passwords, API keys)
- Keep messages concise
- Include unsubscribe option

---

## 📊 Monitoring & Logs

### View Message Logs in Twilio Console

1. Go to: https://console.twilio.com/us1/monitor/logs/messages
2. See all sent/received messages
3. Check delivery status
4. View error codes

### Railway Logs

```bash
railway logs
```

Look for:
- `✅ [Twilio] SMS sent successfully`
- `❌ [Twilio] SMS error`
- `📱 [Twilio] Incoming SMS webhook`
- `💬 [Twilio] Incoming WhatsApp webhook`

---

## 🚨 Troubleshooting

### Issue: "Twilio not configured"

**Solution:**
```bash
# Check environment variables are set
railway variables | grep TWILIO
```

### Issue: "Unable to create record"

**Solution:**
- Check account balance in Twilio Console
- Verify phone number format (+15551234567)
- Ensure "from" number has SMS capability

### Issue: WhatsApp not working

**Solution:**
- Verify you joined the sandbox ("join your-code")
- Check WhatsApp number format (whatsapp:+15551234567)
- For production, ensure WhatsApp Business is approved

### Issue: Webhooks not receiving messages

**Solution:**
1. Check webhook URL is correct in Twilio Console
2. Ensure Railway app is deployed and running
3. Test webhook with Twilio Debugger:
   https://console.twilio.com/us1/monitor/debugger

---

## ✅ Setup Checklist

- [ ] Created Twilio account
- [ ] Purchased phone number
- [ ] Added credentials to Railway
- [ ] Configured SMS webhook
- [ ] Configured WhatsApp webhook (sandbox or production)
- [ ] Tested SMS sending
- [ ] Tested WhatsApp sending
- [ ] Tested incoming message auto-reply
- [ ] Set up status callbacks
- [ ] Integrated with transaction flow (optional)

---

## 🎯 Next Steps

1. **Enable notifications in transactions:**
   - Edit sync/async topup endpoints
   - Add `twilioService.sendTransactionNotification()` calls

2. **Set up daily summaries:**
   - Create cron job or scheduled task
   - Send daily reports to customers

3. **Add to dashboard:**
   - Show notification history
   - Allow customers to opt in/out
   - Configure notification preferences

4. **Scale for production:**
   - Upgrade from Twilio sandbox
   - Get WhatsApp Business approval
   - Set up message templates

---

## 📞 Support

**Twilio Support:**
- Console: https://console.twilio.com/
- Docs: https://www.twilio.com/docs
- Support: https://support.twilio.com/

**Relier Hub Support:**
- Testing Dashboard: https://latcom-fix-production.up.railway.app/test
- Admin Panel: https://latcom-fix-production.up.railway.app/admin

---

**Twilio integration is ready to use!** 🚀📱

Configure your credentials and start sending SMS/WhatsApp notifications immediately.
