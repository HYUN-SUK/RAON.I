-- Migration: Market System (Products, Cart, Orders)
-- Date: 2025-12-21
-- Description: Sets up the tables for the Market MVP.

-- 1. Create Products Table
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  price INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  category TEXT NOT NULL, -- e.g., 'lantern', 'tableware', 'goods'
  stock INTEGER NOT NULL DEFAULT 0,
  images JSONB DEFAULT '[]'::JSONB, -- Array of image URLs
  tags JSONB DEFAULT '[]'::JSONB, -- Array of tag strings
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create Cart Items Table (Synced with DB)
CREATE TABLE IF NOT EXISTS cart_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- User should not have duplicate entries for same product -> use upsert/update quantity
  UNIQUE(user_id, product_id)
);

-- 3. Create Orders Table
CREATE TYPE order_status AS ENUM ('PENDING', 'PAID', 'SHIPPED', 'COMPLETED', 'CANCELLED', 'REFUNDED');

CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL, -- Keep order even if user deleted? Or cascade. Let's Set Null for business record. 
  items JSONB NOT NULL DEFAULT '[]'::JSONB, -- Snapshot of items at purchase: [{ productId, name, price, quantity, ... }]
  total_price INTEGER NOT NULL DEFAULT 0,
  status order_status NOT NULL DEFAULT 'PENDING',
  payment_info JSONB DEFAULT '{}'::JSONB, -- { method: 'card' | 'bank', ... }
  delivery_info JSONB DEFAULT '{}'::JSONB, -- { address, phone, recipient ... }
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);


-- Enable RLS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;


-- Policies for Products
-- Everyone can view active products
CREATE POLICY "Active products are viewable by everyone" ON products
  FOR SELECT USING (is_active = true);

-- Only admins can insert/update/delete products (For MVP, we assume admin has separate RLS or manual DB access, or we add admin policy if needed. For now, strictly public read only)
-- Add Admin policy later if building Admin Console for Market.


-- Policies for Cart Items
-- Users can manage their own cart
CREATE POLICY "Users can view their own cart" ON cart_items
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert into their own cart" ON cart_items
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own cart" ON cart_items
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete from their own cart" ON cart_items
  FOR DELETE USING (auth.uid() = user_id);


-- Policies for Orders
-- Users can view their own orders
CREATE POLICY "Users can view their own orders" ON orders
  FOR SELECT USING (auth.uid() = user_id);

-- Users can create orders
CREATE POLICY "Users can create orders" ON orders
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users typically don't update orders directly (status is handled by admin/system), but maybe cancel? 
-- For MVP, let's allow read/insert.


-- Triggers for updated_at
-- (Assuming update_updated_at_column function exists from previous migrations)

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_products_updated_at') THEN
        CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_cart_items_updated_at') THEN
        CREATE TRIGGER update_cart_items_updated_at BEFORE UPDATE ON cart_items FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_orders_updated_at') THEN
        CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
    END IF;
END $$;
