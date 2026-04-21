CREATE TABLE public.order_returns (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_name text NOT NULL,
  shop_name text,
  phone text NOT NULL,
  address text,
  product_code text NOT NULL,
  product_name text NOT NULL,
  product_description text,
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  total_amount numeric NOT NULL DEFAULT 0,
  notes text,
  version_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.order_returns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Order returns are publicly accessible"
ON public.order_returns
FOR ALL
USING (true)
WITH CHECK (true);

CREATE TRIGGER update_order_returns_updated_at
BEFORE UPDATE ON public.order_returns
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_order_returns_version ON public.order_returns(version_id);
CREATE INDEX idx_order_returns_created_at ON public.order_returns(created_at DESC);