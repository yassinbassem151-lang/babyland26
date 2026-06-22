CREATE OR REPLACE FUNCTION public.execute_readonly_sql(query text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  lower_q text;
BEGIN
  lower_q := lower(btrim(query));
  IF NOT (lower_q LIKE 'select%' OR lower_q LIKE 'with%') THEN
    RAISE EXCEPTION 'Only SELECT queries allowed';
  END IF;
  IF lower_q ~* '\b(insert|update|delete|drop|alter|create|truncate|grant|revoke)\b' THEN
    RAISE EXCEPTION 'Forbidden keyword detected';
  END IF;

  EXECUTE 'SELECT COALESCE(jsonb_agg(t), ''[]''::jsonb) FROM (' || query || ' LIMIT 500) t'
    INTO result;
  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.execute_readonly_sql(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.execute_readonly_sql(text) TO service_role;