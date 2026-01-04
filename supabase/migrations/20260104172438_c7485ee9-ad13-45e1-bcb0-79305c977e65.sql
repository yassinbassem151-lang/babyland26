-- Create expenses table for tracking money taken from deposits
CREATE TABLE public.expenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  amount NUMERIC NOT NULL,
  description TEXT NOT NULL,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- Create policy for public access (matching existing tables pattern)
CREATE POLICY "Expenses are publicly accessible"
ON public.expenses
FOR ALL
USING (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.expenses;