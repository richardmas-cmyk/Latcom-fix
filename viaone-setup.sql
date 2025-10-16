-- Via.One Retail Multi-Store System - Database Schema
-- Creates tables for store management, pricing, and transactions

-- ============================================
-- STORES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS stores (
    id SERIAL PRIMARY KEY,
    store_id VARCHAR(50) UNIQUE NOT NULL,
    store_name VARCHAR(255) NOT NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    owner_id VARCHAR(50), -- Links to owner customer_id
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    last_login TIMESTAMP
);

-- ============================================
-- STORE PRODUCTS & PRICING TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS store_pricing (
    id SERIAL PRIMARY KEY,
    store_id VARCHAR(50),
    product_type VARCHAR(50) NOT NULL, -- 'mobile_topup', 'spei', 'oxxo_gift_card'
    product_name VARCHAR(255),
    cost_per_transaction DECIMAL(10,2) DEFAULT 0, -- What Via.One charges the store
    retail_fee DECIMAL(10,2) DEFAULT 0, -- What store charges customer (owner sets this)
    commission_percentage DECIMAL(5,2) DEFAULT 0, -- Alternative to flat fee
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- STORE TRANSACTIONS TABLE (separate from main transactions)
-- ============================================
CREATE TABLE IF NOT EXISTS store_transactions (
    id SERIAL PRIMARY KEY,
    transaction_id VARCHAR(50) UNIQUE NOT NULL,
    store_id VARCHAR(50) NOT NULL,
    product_type VARCHAR(50) NOT NULL, -- 'mobile_topup', 'spei', 'oxxo_gift_card'
    phone VARCHAR(20), -- For mobile topups
    account_no VARCHAR(50), -- For SPEI
    account_name VARCHAR(255), -- For SPEI
    amount DECIMAL(10,2) NOT NULL, -- Transaction amount
    retail_fee DECIMAL(10,2) DEFAULT 0, -- Fee charged to customer
    cost DECIMAL(10,2) DEFAULT 0, -- Cost to store (Via.One charge)
    profit DECIMAL(10,2) DEFAULT 0, -- Store profit (retail_fee - cost)
    status VARCHAR(20) DEFAULT 'PENDING',
    provider VARCHAR(20), -- MUWE, PPN, CellPay
    provider_transaction_id VARCHAR(100),
    provider_response TEXT,
    barcode_url TEXT, -- For OXXO vouchers
    payment_url TEXT, -- For OXXO vouchers
    created_at TIMESTAMP DEFAULT NOW(),
    processed_at TIMESTAMP
);

-- ============================================
-- OWNER SETTINGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS owner_settings (
    id SERIAL PRIMARY KEY,
    owner_id VARCHAR(50) UNIQUE NOT NULL,
    owner_name VARCHAR(255),
    email VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX IF NOT EXISTS idx_stores_owner ON stores(owner_id);
CREATE INDEX IF NOT EXISTS idx_store_pricing_store ON store_pricing(store_id);
CREATE INDEX IF NOT EXISTS idx_store_trans_store ON store_transactions(store_id);
CREATE INDEX IF NOT EXISTS idx_store_trans_created ON store_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_store_trans_status ON store_transactions(status);

-- ============================================
-- INSERT DEFAULT DATA
-- ============================================

-- Create owner account
INSERT INTO owner_settings (owner_id, owner_name, email, is_active)
VALUES ('OWNER_001', 'Store Owner', 'owner@viaone.mx', true)
ON CONFLICT (owner_id) DO NOTHING;

-- Create 4 stores
INSERT INTO stores (store_id, store_name, username, password_hash, owner_id, is_active)
VALUES
    ('STORE_001', 'Via.One Store 1', 'store1', '$2b$10$placeholder_hash_1', 'OWNER_001', true),
    ('STORE_002', 'Via.One Store 2', 'store2', '$2b$10$placeholder_hash_2', 'OWNER_001', true),
    ('STORE_003', 'Via.One Store 3', 'store3', '$2b$10$placeholder_hash_3', 'OWNER_001', true),
    ('STORE_004', 'Via.One Store 4', 'store4', '$2b$10$placeholder_hash_4', 'OWNER_001', true)
ON CONFLICT (store_id) DO NOTHING;

-- Create default pricing for all stores (owner can adjust these)
INSERT INTO store_pricing (store_id, product_type, product_name, cost_per_transaction, retail_fee, is_active)
VALUES
    -- Store 1 pricing
    ('STORE_001', 'mobile_topup', 'Mobile Topup', 0.00, 5.00, true),
    ('STORE_001', 'spei', 'SPEI Bank Transfer', 0.00, 10.00, true),
    ('STORE_001', 'oxxo_gift_card', 'OXXO Gift Card', 0.00, 5.00, true),

    -- Store 2 pricing
    ('STORE_002', 'mobile_topup', 'Mobile Topup', 0.00, 5.00, true),
    ('STORE_002', 'spei', 'SPEI Bank Transfer', 0.00, 10.00, true),
    ('STORE_002', 'oxxo_gift_card', 'OXXO Gift Card', 0.00, 5.00, true),

    -- Store 3 pricing
    ('STORE_003', 'mobile_topup', 'Mobile Topup', 0.00, 5.00, true),
    ('STORE_003', 'spei', 'SPEI Bank Transfer', 0.00, 10.00, true),
    ('STORE_003', 'oxxo_gift_card', 'OXXO Gift Card', 0.00, 5.00, true),

    -- Store 4 pricing
    ('STORE_004', 'mobile_topup', 'Mobile Topup', 0.00, 5.00, true),
    ('STORE_004', 'spei', 'SPEI Bank Transfer', 0.00, 10.00, true),
    ('STORE_004', 'oxxo_gift_card', 'OXXO Gift Card', 0.00, 5.00, true)
ON CONFLICT DO NOTHING;

-- ============================================
-- NOTES
-- ============================================
-- Password hashes are placeholders - will be generated properly in application
-- Default retail fees:
--   Mobile Topup: 5 MXN per transaction
--   SPEI: 10 MXN per transaction
--   OXXO Gift Card: 5 MXN per transaction
-- Owner can adjust these fees from their dashboard
-- Cost per transaction will be set when Via.One provides pricing
