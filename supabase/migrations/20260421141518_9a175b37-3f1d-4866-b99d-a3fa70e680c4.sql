-- Create order_refunds table to store refund items associated with an order
CREATE TABLE public.order_refunds (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL,
  product_id UUID,
  product_code TEXT NOT NULL,
  product_name TEXT NOT NULL,
  product_description TEXT,
  price NUMERIC NOT NULL DEFAULT 0,
  quantity INTEGER NOT NULL DEFAULT 1,
  version_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for fast lookup per order
CREATE INDEX idx_order_refunds_order_id ON public.order_refunds(order_id);
CREATE INDEX idx_order_refunds_version_id ON public.order_refunds(version_id);

-- Enable RLS - matching existing public access pattern in this project
ALTER TABLE public.order_refunds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Order refunds are publicly accessible"
  ON public.order_refunds
  FOR ALL
  USING (true)
  WITH CHECK (true);