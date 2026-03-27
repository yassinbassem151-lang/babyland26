ALTER TABLE public.products DROP CONSTRAINT products_code_key;
CREATE UNIQUE INDEX products_code_version_unique ON public.products (code, version_id);