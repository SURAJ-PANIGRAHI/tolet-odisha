begin;
-- Run after 20261011_moderation.sql (admin_users must exist).
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete restrict,
  reason text not null check (reason in ('fake', 'scam', 'wrong_contact', 'unavailable', 'misleading_photos', 'wrong_information', 'duplicate', 'other')),
  description text check (char_length(description) <= 1000),
  created_at timestamptz not null default now(),
  check (reason <> 'other' or coalesce(char_length(btrim(description)), 0) > 0)
);
create index reports_listing_created_idx on public.reports(listing_id, created_at desc);
alter table public.reports enable row level security;
revoke all on public.reports from public, anon, authenticated;
grant insert (listing_id, reason, description) on public.reports to anon, authenticated;
grant select on public.reports to authenticated;
create policy "Report public listings" on public.reports for insert to anon, authenticated
  with check (exists (select 1 from public.listings l where l.id = listing_id and l.is_active is true and l.moderation_status = 'approved'));
create policy "Admin reads reports" on public.reports for select to authenticated
  using (exists (select 1 from public.admin_users where user_id = (select auth.uid())));
commit;
