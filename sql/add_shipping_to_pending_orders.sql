-- Add shipping column to pending_orders and orders tables
-- This stores shipping information including service, price, and delivery time

-- Add to pending_orders
ALTER TABLE public.pending_orders
ADD COLUMN IF NOT EXISTS shipping jsonb;

-- Add to orders
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS shipping jsonb;

-- Add comments
COMMENT ON COLUMN public.pending_orders.shipping IS 'Shipping information including service, price, and delivery time';
COMMENT ON COLUMN public.orders.shipping IS 'Shipping information including service, price, and delivery time';
