#!/bin/bash

# Add SmartBiz Telecom via API admin endpoint
# Make sure to set your ADMIN_KEY

ADMIN_KEY="${ADMIN_KEY:-relier_admin_prod_2025}"
API_URL="https://latcom-fix-production.up.railway.app"

echo "Adding SmartBiz Telecom customer..."

curl -X POST "${API_URL}/api/admin/add-customer" \
  -H "Content-Type: application/json" \
  -H "x-admin-key: ${ADMIN_KEY}" \
  -d '{
    "customer_id": "SMARTBIZ_001",
    "company_name": "SmartBiz Telecom",
    "api_key": "smartbiz_prod_7d086ce74101615476169835689efbcd",
    "secret_key": "SBT_545970e108537acd351c88ef1d8f572e52c6422058204102",
    "credit_limit": 50000,
    "current_balance": 50000,
    "commission_percentage": 0,
    "is_active": true
  }'

echo ""
echo ""
echo "Done! Verify with:"
echo "curl ${API_URL}/api/balance -H 'x-api-key: smartbiz_prod_7d086ce74101615476169835689efbcd' -H 'x-customer-id: SMARTBIZ_001'"
