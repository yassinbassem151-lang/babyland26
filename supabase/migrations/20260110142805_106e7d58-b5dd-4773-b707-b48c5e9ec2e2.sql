-- Create versions table
CREATE TABLE public.versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.versions ENABLE ROW LEVEL SECURITY;

-- Create policy
CREATE POLICY "Versions are publicly accessible" 
ON public.versions 
FOR ALL 
USING (true);

-- Add version_id to all relevant tables
ALTER TABLE public.products ADD COLUMN version_id UUID REFERENCES public.versions(id);
ALTER TABLE public.customers ADD COLUMN version_id UUID REFERENCES public.versions(id);
ALTER TABLE public.orders ADD COLUMN version_id UUID REFERENCES public.versions(id);
ALTER TABLE public.order_items ADD COLUMN version_id UUID REFERENCES public.versions(id);
ALTER TABLE public.deposits ADD COLUMN version_id UUID REFERENCES public.versions(id);
ALTER TABLE public.expenses ADD COLUMN version_id UUID REFERENCES public.versions(id);

-- Create indexes for better performance
CREATE INDEX idx_products_version ON public.products(version_id);
CREATE INDEX idx_customers_version ON public.customers(version_id);
CREATE INDEX idx_orders_version ON public.orders(version_id);
CREATE INDEX idx_order_items_version ON public.order_items(version_id);
CREATE INDEX idx_deposits_version ON public.deposits(version_id);
CREATE INDEX idx_expenses_version ON public.expenses(version_id);

-- Create a default version for existing data
INSERT INTO public.versions (name, is_active) VALUES ('النسخة الأصلية', true);

-- Update existing data to use the default version
UPDATE public.products SET version_id = (SELECT id FROM public.versions WHERE name = 'النسخة الأصلية');
UPDATE public.customers SET version_id = (SELECT id FROM public.versions WHERE name = 'النسخة الأصلية');
UPDATE public.orders SET version_id = (SELECT id FROM public.versions WHERE name = 'النسخة الأصلية');
UPDATE public.order_items SET version_id = (SELECT id FROM public.versions WHERE name = 'النسخة الأصلية');
UPDATE public.deposits SET version_id = (SELECT id FROM public.versions WHERE name = 'النسخة الأصلية');
UPDATE public.expenses SET version_id = (SELECT id FROM public.versions WHERE name = 'النسخة الأصلية');

-- Make version_id NOT NULL after populating existing data
ALTER TABLE public.products ALTER COLUMN version_id SET NOT NULL;
ALTER TABLE public.customers ALTER COLUMN version_id SET NOT NULL;
ALTER TABLE public.orders ALTER COLUMN version_id SET NOT NULL;
ALTER TABLE public.order_items ALTER COLUMN version_id SET NOT NULL;
ALTER TABLE public.deposits ALTER COLUMN version_id SET NOT NULL;
ALTER TABLE public.expenses ALTER COLUMN version_id SET NOT NULL;

-- Create function to get next order number for a version
CREATE OR REPLACE FUNCTION public.get_next_order_number(p_version_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  next_number INTEGER;
BEGIN
  SELECT COALESCE(MAX(order_number), 0) + 1 INTO next_number 
  FROM public.orders 
  WHERE version_id = p_version_id;
  RETURN next_number;
END;
$$;