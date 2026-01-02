-- Update the trigger function to deduct by pieces (quantity * multiplier from description)
CREATE OR REPLACE FUNCTION public.deduct_stock_on_order()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    multiplier INTEGER := 1;
    description_text TEXT;
BEGIN
    -- Get the multiplier from product description (e.g., "850/5" -> 5)
    IF NEW.product_description IS NOT NULL AND NEW.product_description ~ '/[0-9]+$' THEN
        multiplier := CAST(SUBSTRING(NEW.product_description FROM '/([0-9]+)$') AS INTEGER);
    END IF;
    
    -- Deduct stock by quantity * multiplier (pieces)
    UPDATE public.products
    SET stock_quantity = stock_quantity - (NEW.quantity * multiplier)
    WHERE id = NEW.product_id;
    
    RETURN NEW;
END;
$function$;