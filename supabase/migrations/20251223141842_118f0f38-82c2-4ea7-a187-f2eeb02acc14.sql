
-- Create function to reset order number sequence
CREATE OR REPLACE FUNCTION public.reset_order_number_sequence()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  max_order_number integer;
BEGIN
  SELECT COALESCE(MAX(order_number), 0) INTO max_order_number FROM public.orders;
  EXECUTE 'ALTER SEQUENCE orders_order_number_seq RESTART WITH ' || (max_order_number + 1);
END;
$function$;
