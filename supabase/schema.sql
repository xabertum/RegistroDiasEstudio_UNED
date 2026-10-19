-- Run once in the Supabase SQL Editor. No passwords or service keys belong here.
begin;

create table public.study_allowed_users (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.study_allowed_users enable row level security;
revoke all on public.study_allowed_users from anon, authenticated;
grant select on public.study_allowed_users to authenticated;
create policy "Read own authorization" on public.study_allowed_users
  for select to authenticated using (user_id = (select auth.uid()));

create table public.study_progress (
  user_id uuid primary key references public.study_allowed_users(user_id) on delete cascade,
  revision integer not null default 0 check (revision >= 0),
  data jsonb not null default '{"version":1,"semanas":{},"estudiados":{}}'::jsonb,
  constraint progress_format check (
    jsonb_typeof(data) = 'object'
    and data @> '{"version":1}'
    and data ? 'semanas' and jsonb_typeof(data->'semanas') = 'object'
    and data ? 'estudiados' and jsonb_typeof(data->'estudiados') = 'object'
    and octet_length(data::text) <= 1048576
  )
);
alter table public.study_progress enable row level security;
revoke all on public.study_progress from anon, authenticated;
grant select on public.study_progress to authenticated;
grant update (data, revision) on public.study_progress to authenticated;

create policy "Read own study progress" on public.study_progress
  for select to authenticated using (
    user_id = (select auth.uid()) and
    exists (select 1 from public.study_allowed_users a where a.user_id = (select auth.uid()))
  );
create policy "Update own study progress" on public.study_progress
  for update to authenticated
  using (
    user_id = (select auth.uid()) and
    exists (select 1 from public.study_allowed_users a where a.user_id = (select auth.uid()))
  )
  with check (
    user_id = (select auth.uid()) and
    exists (select 1 from public.study_allowed_users a where a.user_id = (select auth.uid()))
  );

commit;
