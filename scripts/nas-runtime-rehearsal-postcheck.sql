select 'db_version', current_setting('server_version');

select 'profiles', count(*) from public.profiles;
select 'organizations', count(*) from public.organizations;
select 'auth_users', count(*) from auth.users;
select 'active_invites', count(*)
from public.organization_invites
where accepted_at is null
  and revoked_at is null
  and expires_at > now();

select 'rls_target_tables', count(*)
from pg_catalog.pg_class as relation
join pg_catalog.pg_namespace as namespace
  on namespace.oid = relation.relnamespace
where namespace.nspname = 'public'
  and relation.relname in (
    'profiles',
    'organization_invites',
    'organizations',
    'account_deletion_requests',
    'feedbacks'
  )
  and relation.relrowsecurity;

select 'anon_invite_select',
  has_table_privilege('anon', 'public.organization_invites', 'SELECT');

with service_only_functions(signature) as (
  values
    ('public.claim_account_deletion_request_for_approval(uuid,uuid,uuid,text)'),
    ('public.rollback_account_deletion_request_approval(uuid,uuid,uuid)'),
    ('public.finalize_account_deletion_request_approval(uuid,uuid,uuid)'),
    ('public.reject_account_deletion_request(uuid,uuid,text)')
)
select 'service_only_functions', count(*)
from service_only_functions
where to_regprocedure(signature) is not null;

with service_only_functions(signature) as (
  values
    ('public.claim_account_deletion_request_for_approval(uuid,uuid,uuid,text)'),
    ('public.rollback_account_deletion_request_approval(uuid,uuid,uuid)'),
    ('public.finalize_account_deletion_request_approval(uuid,uuid,uuid)'),
    ('public.reject_account_deletion_request(uuid,uuid,text)')
)
select 'authenticated_service_only_execute', count(*)
from service_only_functions
where has_function_privilege(
  'authenticated',
  to_regprocedure(signature),
  'EXECUTE'
);

with service_only_functions(signature) as (
  values
    ('public.claim_account_deletion_request_for_approval(uuid,uuid,uuid,text)'),
    ('public.rollback_account_deletion_request_approval(uuid,uuid,uuid)'),
    ('public.finalize_account_deletion_request_approval(uuid,uuid,uuid)'),
    ('public.reject_account_deletion_request(uuid,uuid,text)')
)
select 'service_role_service_only_execute', count(*)
from service_only_functions
where has_function_privilege(
  'service_role',
  to_regprocedure(signature),
  'EXECUTE'
);

select 'account_deletion_fk_set_null', count(*)
from pg_catalog.pg_constraint
where conrelid = 'public.account_deletion_requests'::regclass
  and conname in (
    'account_deletion_requests_requester_id_fkey',
    'account_deletion_requests_transfer_to_user_id_fkey',
    'account_deletion_requests_resolved_by_fkey'
  )
  and contype = 'f'
  and confdeltype = 'n';

select 'realtime_runtime_role',
  exists (
    select 1
    from pg_catalog.pg_roles
    where rolname = 'supabase_realtime_admin'
  );

select 'pg_graphql_version', coalesce(
  (
    select extversion
    from pg_catalog.pg_extension
    where extname = 'pg_graphql'
  ),
  'absent'
);

select 'graphql_public_functions', coalesce(
  string_agg(procedure.oid::regprocedure::text, ';' order by procedure.oid::regprocedure::text),
  ''
)
from pg_catalog.pg_proc as procedure
join pg_catalog.pg_namespace as namespace
  on namespace.oid = procedure.pronamespace
where namespace.nspname = 'graphql_public';

select 'public_tables', count(*)
from pg_catalog.pg_class as relation
join pg_catalog.pg_namespace as namespace
  on namespace.oid = relation.relnamespace
where namespace.nspname = 'public'
  and relation.relkind in ('r', 'p');

select 'public_functions', count(*)
from pg_catalog.pg_proc as procedure
join pg_catalog.pg_namespace as namespace
  on namespace.oid = procedure.pronamespace
where namespace.nspname = 'public';

select 'public_noninternal_triggers', count(*)
from pg_catalog.pg_trigger as trigger
join pg_catalog.pg_class as relation
  on relation.oid = trigger.tgrelid
join pg_catalog.pg_namespace as namespace
  on namespace.oid = relation.relnamespace
where namespace.nspname = 'public'
  and not trigger.tgisinternal;

select 'public_policies', count(*)
from pg_catalog.pg_policies
where schemaname = 'public';

select 'public_rls_enabled', count(*)
from pg_catalog.pg_class as relation
join pg_catalog.pg_namespace as namespace
  on namespace.oid = relation.relnamespace
where namespace.nspname = 'public'
  and relation.relkind in ('r', 'p')
  and relation.relrowsecurity;

select 'history', coalesce(string_agg(version, ',' order by version), '')
from supabase_migrations.schema_migrations;
