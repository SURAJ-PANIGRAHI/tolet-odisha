begin;
alter table public.listings alter column moderation_status set default 'pending';
alter table public.listings alter column is_active set default false;
alter table public.listings add constraint listings_approval_consistent check(is_active is not true or moderation_status='approved');
revoke all on public.listings from public, anon, authenticated;
grant select on public.listings to anon,authenticated;
grant update(is_active,moderation_status) on public.listings to authenticated;
-- Submissions now go through server validation. A browser cannot set its own expiry.
revoke insert on public.listings from anon, authenticated;
revoke insert (listing_id, reason, description) on public.reports from anon, authenticated;
grant all on public.listings, public.reports to service_role;
do $$ declare p record; begin
for p in select policyname from pg_policies where schemaname='public' and tablename='listings' loop
execute format('drop policy %I on public.listings',p.policyname);
end loop; end $$;
create policy "Public approved listings" on public.listings for select to anon, authenticated
  using (is_active is true and moderation_status = 'approved' and expires_at > now());

create policy "Admin reads listings" on public.listings for select to authenticated
  using (exists (select 1 from public.admin_users where user_id = (select auth.uid())));
create policy "Admin moderates listings" on public.listings for update to authenticated
  using (exists (select 1 from public.admin_users where user_id = (select auth.uid())))
  with check (exists (select 1 from public.admin_users where user_id = (select auth.uid())));
commit;
