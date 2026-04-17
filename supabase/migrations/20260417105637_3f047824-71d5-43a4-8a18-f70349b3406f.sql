
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS fulfilled boolean NOT NULL DEFAULT false;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS progress_status text NOT NULL DEFAULT 'unfinished';
