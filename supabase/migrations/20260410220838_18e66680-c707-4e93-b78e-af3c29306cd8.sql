
-- Create app_settings table for storing admin password
CREATE TABLE public.app_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key text NOT NULL UNIQUE,
  value text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "App settings are publicly accessible"
ON public.app_settings FOR ALL
USING (true)
WITH CHECK (true);

-- Insert default admin password
INSERT INTO public.app_settings (key, value) VALUES ('admin_password', '1980');

-- Add permissions column to staff_members
ALTER TABLE public.staff_members ADD COLUMN permissions text[] NOT NULL DEFAULT '{}';
