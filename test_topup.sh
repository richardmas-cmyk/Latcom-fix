curl -X POST https://loving-adventure-production.up.railway.app/topup \
  -H "x-api-key: api_key_12345" \
  -H "Content-Type: application/json" \
  -d '{"customer_id": "customer_a", "product_id": "TFE_MEXICO_TOPUP_103_2579_MXN", "amount": 10, "destination": "5615911142"}'
