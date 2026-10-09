begin transaction isolation level repeatable read read only;
set local time zone 'UTC';
select n.nspname as schema,c.relname as name,
((xpath('/table/row/value/text()',query_to_xml(format($sql$
select coalesce(jsonb_agg(jsonb_build_object('key',coalesce((select jsonb_object_agg(key,value)::text from jsonb_each(j) where key=any(%L::text[])),encode(extensions.digest(j::text,'sha256'),'hex')),'hash',encode(extensions.digest((case when %L='public.EventAttachment' then j-array['storagePath','deletedAt'] else j end)::text,'sha256'),'hex'),'full_hash',encode(extensions.digest(j::text,'sha256'),'hex'),'created',coalesce(j->>'createdAt',j->>'created_at'),'updated',coalesce(j->>'updatedAt',j->>'updated_at'))),'[]'::jsonb) as value
from (select to_jsonb(t) as j from %I.%I t) r
$sql$,(select array_agg(a.attname order by a.attnum)::text from pg_index i join pg_attribute a on a.attrelid=c.oid and a.attnum=any(i.indkey) where i.indrelid=c.oid and i.indisprimary),n.nspname||'.'||c.relname,n.nspname,c.relname),true,false,'')))[1]::text)::jsonb as rows
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where ((n.nspname='public' and c.relname<>'_prisma_migrations') or n.nspname='auth') and c.relkind in ('r','p') order by 1,2;
commit;
