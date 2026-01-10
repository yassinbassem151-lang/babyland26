-- Drop the existing unique constraint on order_number
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_order_number_key;

-- Add a composite unique constraint on order_number + version_id
ALTER TABLE public.orders ADD CONSTRAINT orders_order_number_version_unique UNIQUE (order_number, version_id);