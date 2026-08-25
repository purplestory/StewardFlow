-- The archive expects this wrapper to have been installed by Supabase's
-- pg_graphql event trigger before its ACL entry is replayed. A blank database
-- does not yet contain that trigger, so create the production-equivalent
-- wrapper between pre-data restore and the skipped ACL replay.
create or replace function graphql_public.graphql(
  "operationName" text default null,
  query text default null,
  variables jsonb default null,
  extensions jsonb default null
)
returns jsonb
language sql
set search_path to ''
as $$
  select graphql.resolve(
    query := query,
    variables := coalesce(variables, '{}'),
    "operationName" := "operationName",
    extensions := extensions
  );
$$;

alter extension pg_graphql add function graphql_public.graphql(text, text, jsonb, jsonb);

grant all on function graphql_public.graphql(
  "operationName" text,
  query text,
  variables jsonb,
  extensions jsonb
) to postgres, anon, authenticated, service_role;
