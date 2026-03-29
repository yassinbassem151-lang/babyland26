
-- Stock alerts table
CREATE TABLE public.stock_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL,
  product_code text NOT NULL,
  product_name text NOT NULL,
  remaining_quantity integer NOT NULL DEFAULT 0,
  acknowledged boolean NOT NULL DEFAULT false,
  acknowledged_at timestamp with time zone,
  version_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.stock_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Stock alerts are publicly accessible" ON public.stock_alerts FOR ALL TO public USING (true) WITH CHECK (true);

-- Staff members table
CREATE TABLE public.staff_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  password text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.staff_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff members are publicly accessible" ON public.staff_members FOR ALL TO public USING (true) WITH CHECK (true);

-- Add staff columns to orders table
ALTER TABLE public.orders ADD COLUMN staff_member_id uuid;
ALTER TABLE public.orders ADD COLUMN staff_member_name text;
