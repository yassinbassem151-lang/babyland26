CREATE TABLE public.shipping_details (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  version_id UUID NOT NULL,
  customer_name TEXT NOT NULL,
  shop_name TEXT,
  phone TEXT NOT NULL,
  shipping_company TEXT NOT NULL,
  shipping_data TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.shipping_details ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Shipping details are publicly accessible"
ON public.shipping_details
FOR ALL
USING (true)
WITH CHECK (true);

CREATE TRIGGER update_shipping_details_updated_at
BEFORE UPDATE ON public.shipping_details
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_shipping_details_version ON public.shipping_details(version_id);