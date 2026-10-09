-- Apply only to the NEW GCP database, as its migration owner, after all Prisma migrations.
-- Cloud SQL Studio: select the approved staging project/database first.
-- Create cynk_runtime via the Console; keep its password solely in Secret Manager.
BEGIN;
DO $$ BEGIN
  IF current_database() NOT IN ('cynk_staging','cynk_production') THEN RAISE EXCEPTION 'Fresh GCP database required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='cynk_runtime') THEN RAISE EXCEPTION 'Create the dedicated runtime SQL user first'; END IF;
  IF current_user='cynk_runtime' THEN RAISE EXCEPTION 'Use the migration owner, not runtime'; END IF;
END $$;
REVOKE cloudsqlsuperuser FROM cynk_runtime;
ALTER ROLE cynk_runtime NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO cynk_runtime;
DO $$ DECLARE t record; BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename<>'_prisma_migrations' LOOP
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC',t.tablename);
    EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.%I TO cynk_runtime',t.tablename);
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename=t.tablename AND policyname='cynk_backend_access') THEN
      EXECUTE format('CREATE POLICY cynk_backend_access ON public.%I TO cynk_runtime USING (true) WITH CHECK (true)',t.tablename);
    END IF;
  END LOOP;
END $$;
REVOKE ALL ON TABLE public._prisma_migrations FROM cynk_runtime, PUBLIC;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO cynk_runtime;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO cynk_runtime;
COMMIT;
