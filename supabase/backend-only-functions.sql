-- Run in the application's Supabase SQL editor. No table data or function bodies change.
-- Prisma uses the trusted database role; browser roles do not need these helpers.
-- Existing explicit role grants survive REVOKE FROM PUBLIC, so revoke those too.
begin;
do $$
declare
  helper record;
  browser_role text;
begin
  for helper in
    select p.oid::regprocedure as signature
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in (
      'fc_key', 'fc_normalize', 'fc_link', 'fc_overlap', 'fc_cosine',
      'fc_college', 'fc_enqueue', 'fc_post_changed',
      'check_conversation_membership', 'rls_auto_enable'
    )
  loop
    execute format('revoke execute on function %s from public', helper.signature);
    foreach browser_role in array array['anon', 'authenticated'] loop
      if exists (select 1 from pg_roles where rolname = browser_role) then
        execute format('revoke execute on function %s from %I', helper.signature, browser_role);
      end if;
    end loop;
  end loop;
end $$;
commit;
