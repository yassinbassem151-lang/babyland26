-- Update the record_deposit function to include version_id
CREATE OR REPLACE FUNCTION public.record_deposit()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.deposit_amount > 0 AND NEW.deposit_method IS NOT NULL THEN
    INSERT INTO public.deposits (order_id, order_number, customer_name, amount, method, version_id)
    VALUES (NEW.id, NEW.order_number, NEW.customer_name, NEW.deposit_amount, NEW.deposit_method, NEW.version_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create the trigger if it doesn't exist
DROP TRIGGER IF EXISTS record_deposit_trigger ON public.orders;
CREATE TRIGGER record_deposit_trigger
AFTER INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.record_deposit();