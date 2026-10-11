begin;
-- Administrative membership is writable only through the SQL editor/service role.
create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.admin_users enable row level security;
revoke all on public.admin_users from public, anon, authenticated;
grant select on public.admin_users to authenticated;
create policy "Read own admin membership" on public.admin_users
  for select to authenticated using (user_id = (select auth.uid()));

alter table public.listings add column if not exists moderation_status text not null default 'pending';
update public.listings set moderation_status = 'approved' where is_active is true;
alter table public.listings alter column is_active set default false;
alter table public.listings alter column is_featured set default false;
alter table public.listings add constraint listings_moderation_status
  check (moderation_status in ('pending', 'approved', 'rejected'));
alter table public.listings add constraint listings_approval_consistent
  check (is_active is not true or moderation_status = 'approved');

-- Replace existing policies: permissive policies are OR-ed, so leaving an old
-- broad insert/update policy would defeat the moderation boundary.
do $$ declare p record; begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'listings' loop
    execute format('drop policy %I on public.listings', p.policyname);
  end loop;
end $$;
alter table public.listings enable row level security;
revoke all on public.listings from public, anon, authenticated;
grant select, insert on public.listings to anon, authenticated;
grant update (is_active, moderation_status) on public.listings to authenticated;
create policy "Public approved listings" on public.listings for select to anon, authenticated
  using (is_active is true and moderation_status = 'approved');
create policy "Submit pending listings" on public.listings for insert to anon, authenticated
  with check (is_active is false and is_featured is false and moderation_status = 'pending');
create policy "Admin reads listings" on public.listings for select to authenticated
  using (exists (select 1 from public.admin_users where user_id = (select auth.uid())));
create policy "Admin moderates listings" on public.listings for update to authenticated
  using (exists (select 1 from public.admin_users where user_id = (select auth.uid())))
  with check (exists (select 1 from public.admin_users where user_id = (select auth.uid())));
commit;
