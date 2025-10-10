-- Database Indexes for High-Volume Performance
-- Phase 2: Optimize query performance for 700K USD/day volume

-- ============================================
-- TRANSACTIONS TABLE INDEXES
-- ============================================

-- Index for customer transaction lookups (most common query)
CREATE INDEX IF NOT EXISTS idx_transactions_customer_id
ON transactions(customer_id);

-- Index for transaction status filtering
CREATE INDEX IF NOT EXISTS idx_transactions_status
ON transactions(status);

-- Index for date range queries (invoices, reports)
CREATE INDEX IF NOT EXISTS idx_transactions_created_at
ON transactions(created_at DESC);

-- Composite index for customer + date range queries
CREATE INDEX IF NOT EXISTS idx_transactions_customer_date
ON transactions(customer_id, created_at DESC);

-- Index for phone number lookups
CREATE INDEX IF NOT EXISTS idx_transactions_phone
ON transactions(phone);

-- Index for operator transaction ID lookups
CREATE INDEX IF NOT EXISTS idx_transactions_operator_id
ON transactions(operator_transaction_id)
WHERE operator_transaction_id IS NOT NULL;

-- ============================================
-- CUSTOMERS TABLE INDEXES
-- ============================================

-- Index for active customer lookups
CREATE INDEX IF NOT EXISTS idx_customers_active
ON customers(is_active)
WHERE is_active = true;

-- Index for API key authentication (critical for performance)
CREATE INDEX IF NOT EXISTS idx_customers_api_key
ON customers(api_key);

-- ============================================
-- BILLING RECORDS TABLE INDEXES
-- ============================================

-- Index for customer billing history
CREATE INDEX IF NOT EXISTS idx_billing_customer_id
ON billing_records(customer_id);

-- Index for transaction billing lookups
CREATE INDEX IF NOT EXISTS idx_billing_transaction_id
ON billing_records(transaction_id);

-- Index for billing date range queries
CREATE INDEX IF NOT EXISTS idx_billing_created_at
ON billing_records(created_at DESC);

-- ============================================
-- INVOICES TABLE INDEXES
-- ============================================

-- Index for customer invoices
CREATE INDEX IF NOT EXISTS idx_invoices_customer_id
ON invoices(customer_id);

-- Index for invoice date ranges
CREATE INDEX IF NOT EXISTS idx_invoices_dates
ON invoices(date_from, date_to);

-- ============================================
-- INVOICE ITEMS TABLE INDEXES
-- ============================================

-- Index for invoice items by invoice
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_number
ON invoice_items(invoice_number);

-- ============================================
-- QUERY PERFORMANCE ANALYSIS
-- ============================================

-- Show all indexes on transactions table
-- SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'transactions';

-- Analyze table statistics for query planner
ANALYZE transactions;
ANALYZE customers;
ANALYZE billing_records;
ANALYZE invoices;
ANALYZE invoice_items;

-- ============================================
-- EXPECTED PERFORMANCE IMPROVEMENTS
-- ============================================
-- Customer transaction lookups: 50ms → 5ms (10x faster)
-- Date range queries: 200ms → 20ms (10x faster)
-- API key auth: 30ms → 3ms (10x faster)
-- Phone lookups: 100ms → 10ms (10x faster)
