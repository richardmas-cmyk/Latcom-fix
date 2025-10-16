-- Add SmartBiz Telecom Customer to Database
-- Generated: October 14, 2025
-- Customer: SmartBiz Telecom
-- Purpose: Latcom/Telcel mobile topups via multi-provider middleware

-- Insert SmartBiz Telecom customer
INSERT INTO customers (
    customer_id,
    company_name,
    api_key,
    secret_key,
    credit_limit,
    current_balance,
    commission_percentage,
    is_active,
    created_at
) VALUES (
    'SMARTBIZ_001',
    'SmartBiz Telecom',
    'smartbiz_prod_7d086ce74101615476169835689efbcd',
    'SBT_545970e108537acd351c88ef1d8f572e52c6422058204102',
    50000.00,
    50000.00,
    0.00,
    true,
    NOW()
) ON CONFLICT (customer_id) DO UPDATE SET
    api_key = EXCLUDED.api_key,
    secret_key = EXCLUDED.secret_key,
    credit_limit = EXCLUDED.credit_limit,
    current_balance = EXCLUDED.current_balance,
    commission_percentage = EXCLUDED.commission_percentage,
    is_active = EXCLUDED.is_active;

-- Verify the customer was created
SELECT
    customer_id,
    company_name,
    credit_limit,
    current_balance,
    commission_percentage,
    is_active,
    created_at
FROM customers
WHERE customer_id = 'SMARTBIZ_001';
