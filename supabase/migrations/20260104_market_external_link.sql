-- Migration: Add External Link support to Products
-- Date: 2026-01-04

-- 1. Add 'type' and 'link' columns to products table
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'INTERNAL' CHECK (type IN ('INTERNAL', 'EXTERNAL')),
ADD COLUMN IF NOT EXISTS link TEXT;

-- 2. Index for filtering by type (optional but good practice)
CREATE INDEX IF NOT EXISTS idx_products_type ON products(type);

-- 3. Comments
COMMENT ON COLUMN products.type IS 'Product type: INTERNAL (Direct Sales) or EXTERNAL (Affiliate Link)';
COMMENT ON COLUMN products.link IS 'External link URL for EXTERNAL type products';
