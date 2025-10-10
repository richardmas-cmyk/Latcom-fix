# 🔧 Latcom Mode Switcher Guide

Control how amounts are sent to Latcom via the `LATCOM_MODE` environment variable.

---

## 🎯 Available Modes

### **1. RAW Mode**
**Setting:** `LATCOM_MODE=RAW`

**Behavior:**
- ✅ Always uses **open range product** (`TFE_MXN_20_TO_2000`)
- ✅ Sends **exact amount** (no formulas, no adjustments)
- ✅ Good for testing what Latcom actually does

**Example:**
- Customer orders: 20 MXN
- We send: **20 MXN** (no adjustment)
- Customer receives: ??? (test to find out)

---

### **2. VAT_ADJUSTED Mode**
**Setting:** `LATCOM_MODE=VAT_ADJUSTED`

**Behavior:**
- ✅ Always uses **open range product** (`TFE_MXN_20_TO_2000`)
- ✅ Applies **VAT formula:** `send_mxn = amount / 1.16`
- ✅ Customer receives exact amount (Latcom adds 16% VAT)

**Example:**
- Customer orders: 30 MXN
- We send: **25.86 MXN** (30 ÷ 1.16)
- Latcom adds 16%: 25.86 × 1.16 = 30.00 MXN
- Customer receives: **30.00 MXN** ✅

**Conversion Table:**
```
Customer Orders → We Send
20 MXN         → 17.24 MXN
30 MXN         → 25.86 MXN
50 MXN         → 43.10 MXN
100 MXN        → 86.21 MXN
```

---

### **3. HYBRID Mode** (Default)
**Setting:** `LATCOM_MODE=HYBRID` (or not set)

**Behavior:**
- ✅ For **10, 20 MXN:** Use **XOOM fixed products** (no adjustment)
- ✅ For **30+ MXN:** Use **open range** with VAT formula
- ✅ Best of both worlds

**Example:**
- 10 MXN → `XOOM_10_MXN` → Customer gets 10.00 MXN
- 20 MXN → `XOOM_20_MXN` → Customer gets 20.00 MXN
- 30 MXN → Open range (25.86 MXN sent) → Customer gets 30.00 MXN
- 50 MXN → Open range (43.10 MXN sent) → Customer gets 50.00 MXN

---

## 🚀 How to Switch Modes

### **Option A: Railway Dashboard (Easiest)**

1. Go to Railway Dashboard → Your Project
2. Click **Variables** tab
3. Add/Edit variable:
   - Name: `LATCOM_MODE`
   - Value: `RAW` or `VAT_ADJUSTED` or `HYBRID`
4. Click **Save**
5. Railway auto-redeploys (30-60 seconds)

### **Option B: Railway CLI**

```bash
# Set to RAW mode
railway variables --set LATCOM_MODE=RAW

# Set to VAT_ADJUSTED mode
railway variables --set LATCOM_MODE=VAT_ADJUSTED

# Set to HYBRID mode (or remove variable)
railway variables --set LATCOM_MODE=HYBRID

# Remove variable (defaults to HYBRID)
railway variables --unset LATCOM_MODE
```

---

## 🧪 Testing Workflow

### **Test 1: Find out what Latcom does**
```bash
# Set RAW mode
railway variables --set LATCOM_MODE=RAW

# Wait 1 minute for redeploy

# Send test
curl -X POST https://latcom-fix-production.up.railway.app/api/enviadespensa/topup \
  -H "x-api-key: enviadespensa_prod_2025" \
  -H "x-customer-id: ENVIADESPENSA_001" \
  -H "Content-Type: application/json" \
  -d '{"phone": "5566374683", "amount": 20, "provider": "LATCOM"}'

# Check customer's phone balance
# If they got 23.20 MXN → Latcom adds 16%
# If they got 20.00 MXN → Latcom doesn't add VAT
```

### **Test 2: Use correct formula**
```bash
# Set VAT_ADJUSTED mode
railway variables --set LATCOM_MODE=VAT_ADJUSTED

# Wait 1 minute

# Send test
curl -X POST https://latcom-fix-production.up.railway.app/api/enviadespensa/topup \
  -H "x-api-key: enviadespensa_prod_2025" \
  -H "x-customer-id: ENVIADESPENSA_001" \
  -H "Content-Type: application/json" \
  -d '{"phone": "5566374683", "amount": 30, "provider": "LATCOM"}'

# Customer should receive exactly 30.00 MXN
```

### **Test 3: Production mode**
```bash
# Set HYBRID mode (best for production)
railway variables --set LATCOM_MODE=HYBRID

# Use XOOM for 10,20 MXN + open range with VAT for 30+
```

---

## 📊 Quick Reference

| Mode | 10 MXN | 20 MXN | 30 MXN | 50+ MXN |
|------|--------|--------|--------|---------|
| **RAW** | Send 10 (open range) | Send 20 (open range) | Send 30 (open range) | Send exact (open range) |
| **VAT_ADJUSTED** | Send 8.62 (open range) | Send 17.24 (open range) | Send 25.86 (open range) | Send amount/1.16 (open range) |
| **HYBRID** | XOOM_10_MXN | XOOM_20_MXN | Send 25.86 (open range) | Send amount/1.16 (open range) |

---

## ✅ Current Mode

Check logs to see which mode is active:

```bash
railway logs | grep "Latcom] Mode"
```

Output:
```
🔧 [Latcom] Mode: RAW
🔧 [Latcom] Mode: VAT_ADJUSTED
🔧 [Latcom] Mode: HYBRID
```

---

## 🎯 Recommended Setup

1. **Testing:** Start with `RAW` mode to see what Latcom actually does
2. **Validation:** Use `VAT_ADJUSTED` once you confirm Latcom adds 16%
3. **Production:** Use `HYBRID` for best results (XOOM for small, open range for large)

---

**No code changes needed! Just switch the environment variable in Railway.**
