-- migrate:up
-- Record versions let the Admin UI detect edits made directly in Supabase.
CREATE FUNCTION hope_touch_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at=clock_timestamp(); RETURN NEW; END $$;
DO $$ DECLARE tab text; BEGIN
 FOREACH tab IN ARRAY ARRAY['employee','department','job','jobhistory','customer','sales','product','salesdetail','payment','pricehist','users'] LOOP
  EXECUTE format('ALTER TABLE public.%I ADD COLUMN updated_at timestamptz NOT NULL DEFAULT clock_timestamp()',tab);
  EXECUTE format('CREATE TRIGGER zz_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION hope_touch_updated_at()',tab);
 END LOOP;
END $$;
CREATE FUNCTION hope_mutate_checked(p_actor uuid,p_table text,p_operation text,p_key jsonb,p_data jsonb,p_expected timestamptz)
RETURNS jsonb LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE actual timestamptz;
BEGIN
 IF p_table NOT IN ('employee','department','job','jobhistory','customer','sales','product','salesdetail','payment','pricehist','users') OR p_key='{}'
 THEN RAISE EXCEPTION 'Invalid record key'; END IF;
 EXECUTE format('SELECT updated_at FROM %I t WHERE to_jsonb(t) @> $1 FOR UPDATE',p_table) INTO actual USING p_key;
 IF actual IS NULL THEN RAISE EXCEPTION 'Record not found' USING ERRCODE='P0002'; END IF;
 IF actual IS DISTINCT FROM p_expected THEN RAISE EXCEPTION 'This record changed elsewhere. Refresh the record before saving your changes.' USING ERRCODE='40001'; END IF;
 RETURN hope_mutate(p_actor,p_table,p_operation,p_key,p_data);
END $$;
REVOKE EXECUTE ON FUNCTION hope_mutate_checked(uuid,text,text,jsonb,jsonb,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION hope_mutate_checked(uuid,text,text,jsonb,jsonb,timestamptz) TO service_role;
INSERT INTO app_migration(version) VALUES('202611070002_live_ui_versions');
NOTIFY pgrst,'reload schema';
-- migrate:down
DO $$ BEGIN RAISE EXCEPTION 'Forward-only migration: restore a snapshot instead.'; END $$;
