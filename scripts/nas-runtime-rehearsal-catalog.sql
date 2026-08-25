with catalog(kind, name) as (
  select 'function',
    'public.' || procedure.proname || '(' ||
      regexp_replace(
        procedure.oid::regprocedure::text,
        '^[^(]*\((.*)\)$',
        '\1'
      ) || ')'
  from pg_catalog.pg_proc as procedure
  join pg_catalog.pg_namespace as namespace
    on namespace.oid = procedure.pronamespace
  where namespace.nspname = 'public'

  union all

  select 'policy', policy.tablename || '|' || policy.policyname
  from pg_catalog.pg_policies as policy
  where policy.schemaname = 'public'

  union all

  select 'rls', relation.relname
  from pg_catalog.pg_class as relation
  join pg_catalog.pg_namespace as namespace
    on namespace.oid = relation.relnamespace
  where namespace.nspname = 'public'
    and relation.relkind in ('r', 'p')
    and relation.relrowsecurity

  union all

  select 'table', relation.relname
  from pg_catalog.pg_class as relation
  join pg_catalog.pg_namespace as namespace
    on namespace.oid = relation.relnamespace
  where namespace.nspname = 'public'
    and relation.relkind in ('r', 'p')

  union all

  select 'trigger', relation.relname || '|' || trigger.tgname
  from pg_catalog.pg_trigger as trigger
  join pg_catalog.pg_class as relation
    on relation.oid = trigger.tgrelid
  join pg_catalog.pg_namespace as namespace
    on namespace.oid = relation.relnamespace
  where namespace.nspname = 'public'
    and not trigger.tgisinternal
)
select kind || '|' || name
from catalog
order by kind, name;
