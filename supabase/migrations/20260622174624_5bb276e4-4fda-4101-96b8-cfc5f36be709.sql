CREATE OR REPLACE FUNCTION public.execute_readonly_sql(query text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  cleaned_query text;
  lower_q text;
BEGIN
  cleaned_query := regexp_replace(btrim(query), ';+\s*$', '');
  lower_q := lower(cleaned_query);

  IF NOT (lower_q LIKE 'select%' OR lower_q LIKE 'with%') THEN
    RAISE EXCEPTION 'Only read-only report queries are allowed';
  END IF;

  IF lower_q ~* '\b(insert|update|delete|drop|alter|create|truncate|grant|revoke|comment|copy|call|do|execute)\b' THEN
    RAISE EXCEPTION 'This report query contains an unsafe command';
  END IF;

  IF lower_q ~* ';' THEN
    RAISE EXCEPTION 'Only one report query is allowed';
  END IF;

  EXECUTE 'SELECT COALESCE(jsonb_agg(t), ''[]''::jsonb) FROM (' || cleaned_query || ') t'
    INTO result;

  RETURN COALESCE(result, '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.execute_readonly_sql(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.execute_readonly_sql(text) TO service_role;