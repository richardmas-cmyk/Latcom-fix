# IP Whitelisting Guide

## Overview

IP whitelisting adds an extra layer of security by restricting API access to specific IP addresses. This ensures that only requests from authorized locations can process transactions.

## When to Use IP Whitelisting

✅ **Recommended for:**
- Production environments with static IPs
- High-security customers
- Customers with predictable network infrastructure
- Preventing unauthorized access even if API keys are compromised

⚠️ **Not recommended for:**
- Development/testing environments
- Customers with dynamic IPs
- Mobile applications
- Distributed systems without static IPs

## How It Works

1. Customer provides their static IP address(es)
2. Admin enables IP whitelisting for the customer
3. System checks incoming request IP against whitelist
4. Only requests from whitelisted IPs are processed

## Setup Instructions

### Step 1: Get Customer's IP Address

The customer can find their IP by visiting:
```
https://latcom-fix-production.up.railway.app/api/check-ip
```

Or by running:
```bash
curl https://api.ipify.org?format=json
```

### Step 2: Enable IP Whitelisting (Admin Only)

Using SQL (via Railway CLI):
```bash
railway run psql -c "UPDATE customers
SET ip_whitelist_enabled = true,
    allowed_ips = '[\"1.2.3.4\", \"5.6.7.8\"]'::jsonb
WHERE customer_id = 'HAZ_001';"
```

Or using a script:
```bash
railway run node enable-ip-whitelist.js HAZ_001 1.2.3.4,5.6.7.8
```

### Step 3: Test the Whitelisting

Test from allowed IP (should succeed):
```bash
curl -X POST https://latcom-fix-production.up.railway.app/api/enviadespensa/topup \
  -H "Content-Type: application/json" \
  -H "x-api-key: haz_prod_2025" \
  -H "x-customer-id: HAZ_001" \
  -d '{"phone":"5566374683","amount":20}'
```

Test from non-whitelisted IP (should fail):
```
Response: {"success":false,"error":"IP address not authorized","your_ip":"x.x.x.x"}
```

## Management Commands

### View Current Whitelist

```sql
SELECT customer_id, company_name, ip_whitelist_enabled, allowed_ips
FROM customers
WHERE customer_id = 'HAZ_001';
```

### Add IP to Whitelist

```sql
UPDATE customers
SET allowed_ips = allowed_ips || '["9.10.11.12"]'::jsonb
WHERE customer_id = 'HAZ_001';
```

### Remove IP from Whitelist

```sql
UPDATE customers
SET allowed_ips = allowed_ips - '9.10.11.12'
WHERE customer_id = 'HAZ_001';
```

### Disable IP Whitelisting

```sql
UPDATE customers
SET ip_whitelist_enabled = false
WHERE customer_id = 'HAZ_001';
```

### Re-enable IP Whitelisting

```sql
UPDATE customers
SET ip_whitelist_enabled = true
WHERE customer_id = 'HAZ_001';
```

## Customer-Specific Examples

### HAZ Group Example

If HAZ Group has two servers:
- Production Server: `203.0.113.10`
- Backup Server: `203.0.113.20`

Setup:
```bash
railway run psql -c "UPDATE customers
SET ip_whitelist_enabled = true,
    allowed_ips = '[\"203.0.113.10\", \"203.0.113.20\"]'::jsonb
WHERE customer_id = 'HAZ_001';"
```

### EnviaDespensa Example (No Whitelist)

EnviaDespensa uses dynamic IPs, so whitelisting is disabled:
```bash
railway run psql -c "UPDATE customers
SET ip_whitelist_enabled = false
WHERE customer_id = 'ENVIADESPENSA_001';"
```

## Security Considerations

### What IP Whitelisting Protects Against:
- ✅ Stolen API keys used from unauthorized locations
- ✅ Credential stuffing attacks
- ✅ Unauthorized access attempts
- ✅ Man-in-the-middle attacks (combined with HTTPS)

### What It Doesn't Protect Against:
- ❌ Attacks from whitelisted IPs
- ❌ Compromised servers on whitelisted IPs
- ❌ Internal threats from authorized locations

### Best Practices:
1. **Use narrow IP ranges** - Only whitelist necessary IPs
2. **Combine with API key rotation** - Change keys periodically
3. **Monitor logs** - Watch for failed IP authentication attempts
4. **Update promptly** - Remove IPs when infrastructure changes
5. **Document changes** - Keep records of whitelist modifications

## Tr oubleshooting

### Issue: "IP address not authorized"

**Solution:**
1. Check your current IP: `curl https://api.ipify.org`
2. Verify whitelist: Check `allowed_ips` in database
3. Confirm whitelisting is enabled: Check `ip_whitelist_enabled = true`
4. Check for typos in IP addresses
5. Consider proxy/NAT effects - your public IP may differ from your local IP

### Issue: Dynamic IP Changed

**Solution:**
1. Disable IP whitelisting temporarily:
```sql
UPDATE customers SET ip_whitelist_enabled = false WHERE customer_id = 'HAZ_001';
```

2. Get new IP and update whitelist
3. Re-enable whitelisting

### Issue: Multiple IPs Needed

**Solution:**
Add all necessary IPs to the array:
```sql
UPDATE customers
SET allowed_ips = '["1.2.3.4", "5.6.7.8", "9.10.11.12", "13.14.15.16"]'::jsonb
WHERE customer_id = 'HAZ_001';
```

## API Response Examples

### Success (IP Whitelisted):
```json
{
  "success": true,
  "transaction": {
    "id": "RLR1760353500123",
    "status": "SUCCESS",
    "amount_mxn": 20,
    ...
  }
}
```

### Failure (IP Not Whitelisted):
```json
{
  "success": false,
  "error": "IP address not authorized",
  "your_ip": "38.64.20.153"
}
```

## Logging

When IP whitelisting is active, the system logs:

**Allowed IP:**
```
✅ IP 203.0.113.10 verified for customer HAZ_001
```

**Blocked IP:**
```
🚫 IP 38.64.20.153 not whitelisted for customer HAZ_001
```

Check logs:
```bash
railway logs | grep "IP"
```

## Integration with Monitoring

IP whitelist failures are logged and can be monitored via:
- Railway logs: `railway logs`
- Admin dashboard: `https://latcom-fix-production.up.railway.app/admin`
- Metrics API: `/api/admin/metrics`

## FAQ

**Q: Can I have multiple IPs whitelisted?**
A: Yes, add as many as needed to the `allowed_ips` array.

**Q: What if my IP changes frequently?**
A: Consider disabling IP whitelisting for that customer and rely on API key security instead.

**Q: Can I whitelist IP ranges (CIDR)?**
A: Not currently supported. You must list individual IPs.

**Q: What happens if I whitelist the wrong IP?**
A: The customer won't be able to connect. They'll see "IP address not authorized".

**Q: Can customers manage their own whitelist?**
A: Not currently. Only admins can modify whitelists via database or scripts.

**Q: Does IP whitelisting affect rate limiting?**
A: No, rate limiting is applied separately based on customer ID.

## Next Steps

After setting up IP whitelisting:

1. ✅ Test from whitelisted IP
2. ✅ Test from non-whitelisted IP (should fail)
3. ✅ Document customer's whitelisted IPs
4. ✅ Set up monitoring for IP auth failures
5. ✅ Establish process for updating IPs when infrastructure changes

---

**Questions?** Contact admin with customer ID and requested IP changes.

**Last Updated:** 2025-10-13
