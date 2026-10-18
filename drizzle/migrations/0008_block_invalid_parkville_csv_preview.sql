CREATE OR REPLACE FUNCTION public.csv_block_invalid_preview_commit() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
IF NEW.status = 'committing' AND NEW.id = '9b32b6fb-7dcc-4d62-a91f-9f4ca7e85536'::uuid THEN
RAISE EXCEPTION 'Invalid Parkville CSV preview: quoted fields were parsed incorrectly. Upload the original file for a fresh preview before confirmation.' USING ERRCODE='23514';
END IF;
RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.csv_block_invalid_preview_commit() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER csv_invalid_preview_commit_guard BEFORE UPDATE OF status ON public.booking_import_runs FOR EACH ROW EXECUTE FUNCTION public.csv_block_invalid_preview_commit();
COMMENT ON FUNCTION public.csv_block_invalid_preview_commit() IS 'Blocks only the diagnosed corrupt source179 preview; retains all persisted evidence and holds unchanged.';