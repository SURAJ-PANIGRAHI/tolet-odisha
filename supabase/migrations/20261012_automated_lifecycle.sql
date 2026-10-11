begin;
-- Apply after the moderation and reports migrations.
alter table public.listings add column expires_at timestamptz;
update public.listings set expires_at = coalesce(created_at, now()) + interval '30 days';
alter table public.listings alter column expires_at set default (now() + interval '30 days');
alter table public.listings alter column expires_at set not null;
create index listings_expiry_idx on public.listings(expires_at) where is_active is true;

create table public.listing_owner_contacts (
  listing_id uuid primary key references public.listings(id) on delete cascade,
  email text not null,
  verified_at timestamptz,
  cycle timestamptz not null
);
create table public.notification_jobs (
  id uuid primary key default gen_random_uuid(),
  dedupe_key text not null unique,
  listing_id uuid not null references public.listings(id) on delete cascade,
  kind text not null check(kind in ('report', 'verify', 'renewal')),
  recipient text not null,
  cycle timestamptz,
  subject text not null,
  body text not null,
  available_at timestamptz not null default now(),
  attempts integer not null default 0,
  sent_at timestamptz,
  last_error text,
  created_at timestamptz not null default now()
);
create table public.submission_quotas (scope text not null, window_start timestamptz not null, count integer not null, primary key(scope, window_start));
alter table public.listing_owner_contacts enable row level security;
alter table public.notification_jobs enable row level security;
alter table public.submission_quotas enable row level security;
revoke all on public.listing_owner_contacts, public.notification_jobs, public.submission_quotas from public, anon, authenticated;
grant all on public.listing_owner_contacts, public.notification_jobs, public.submission_quotas to service_role;

-- Submissions now go through server validation. A browser cannot set its own expiry.
revoke insert on public.listings from anon, authenticated;
revoke insert (listing_id, reason, description) on public.reports from anon, authenticated;
grant all on public.listings, public.reports to service_role;
drop policy "Public approved listings" on public.listings;
create policy "Public approved listings" on public.listings for select to anon, authenticated
  using (is_active is true and moderation_status = 'approved' and expires_at > now());

create function public.consume_submission_quota(p_scope text, p_limit integer) returns boolean
language plpgsql set search_path = '' as $$
declare n integer;
begin
  insert into public.submission_quotas(scope, window_start, count) values(p_scope, date_trunc('hour', now()), 1)
  on conflict(scope, window_start) do update set count = public.submission_quotas.count + 1 returning count into n;
  return n <= p_limit;
end $$;

create function public.submit_listing_report(p_listing uuid, p_reason text, p_description text) returns void
language plpgsql set search_path = '' as $$
declare r uuid; t text;
begin
  select title into t from public.listings where id = p_listing and is_active is true and moderation_status = 'approved' and expires_at > now();
  if not found then raise exception 'Listing unavailable'; end if;
  insert into public.reports(listing_id, reason, description) values(p_listing, p_reason, p_description) returning id into r;
  insert into public.notification_jobs(dedupe_key, listing_id, kind, recipient, subject, body)
  values('report:' || r, p_listing, 'report', 'surajpanigrahi.95@gmail.com', 'ToLet Odisha: listing report',
    'Listing: ' || t || E'\nID: ' || p_listing || E'\nReason: ' || p_reason || E'\nDetails: ' || coalesce(p_description, '(none)') || E'\nReview: https://www.toletodisha.in/admin');
end $$;

create function public.submit_listing_with_owner(p_listing jsonb, p_email text) returns uuid
language plpgsql set search_path = '' as $$
declare new_id uuid; deadline timestamptz;
begin
  insert into public.listings(title, description, category, rent_monthly, deposit, district, locality, landmark, contact_name, contact_phone, whatsapp_number, amenities, images, is_active, is_featured, moderation_status)
  values(p_listing->>'title', p_listing->>'description', p_listing->>'category', (p_listing->>'rent_monthly')::integer, (p_listing->>'deposit')::integer, p_listing->>'district', p_listing->>'locality', p_listing->>'landmark', p_listing->>'contact_name', p_listing->>'contact_phone', p_listing->>'whatsapp_number', array(select jsonb_array_elements_text(p_listing->'amenities')), array(select jsonb_array_elements_text(p_listing->'images')), false, false, 'pending')
  returning id, expires_at into new_id, deadline;
  insert into public.listing_owner_contacts(listing_id, email, cycle) values(new_id, p_email, deadline);
  insert into public.notification_jobs(dedupe_key, listing_id, kind, recipient, cycle, subject, body)
    values('verify:' || new_id, new_id, 'verify', p_email, deadline, 'Confirm your ToLet Odisha listing email', 'Confirm this email address for your listing. Your listing requires administrator approval and expires after 30 days. If you did not submit a listing, ignore this email.');
  return new_id;
end $$;

create function public.confirm_listing_owner(p_listing uuid, p_cycle timestamptz, p_renew boolean) returns boolean
language plpgsql set search_path = '' as $$
declare listing public.listings; owner public.listing_owner_contacts; next_cycle timestamptz;
begin
  select * into listing from public.listings where id = p_listing for update;
  if not found or listing.moderation_status = 'rejected' then return false; end if;
  select * into owner from public.listing_owner_contacts where listing_id = p_listing for update;
  if not found or owner.cycle <> p_cycle or now() > p_cycle + interval '7 days' then return false; end if;
  if p_renew then
    -- Renew only approved listings near expiry; never undo a manual rejection/unpublish.
    if listing.moderation_status <> 'approved' or now() < listing.expires_at - interval '2 days' then return false; end if;
    next_cycle := now() + interval '30 days';
    update public.listings set expires_at = next_cycle, is_active = true where id = p_listing;
    update public.listing_owner_contacts set verified_at = coalesce(verified_at, now()), cycle = next_cycle where listing_id = p_listing;
  else
    update public.listing_owner_contacts set verified_at = coalesce(verified_at, now()) where listing_id = p_listing;
  end if;
  return true;
end $$;

create function public.run_listing_lifecycle() returns void
language plpgsql set search_path = '' as $$
begin
  insert into public.notification_jobs(dedupe_key, listing_id, kind, recipient, cycle, subject, body)
  select 'renew:' || l.id || ':' || l.expires_at::text, l.id, 'renewal', c.email, c.cycle, 'Still available? Renew your ToLet Odisha listing',
    'Your listing "' || l.title || '" expires on ' || to_char(l.expires_at at time zone 'Asia/Kolkata', 'YYYY-MM-DD HH24:MI') || ' IST. Would you like to list it for another 30 days?'
  from public.listings l join public.listing_owner_contacts c on c.listing_id = l.id
  where l.moderation_status = 'approved' and l.is_active is true and c.verified_at is not null
    and l.expires_at > now() and l.expires_at <= now() + interval '2 days'
  on conflict(dedupe_key) do nothing;
  update public.listings set is_active = false where is_active is true and expires_at <= now();
  delete from public.submission_quotas where window_start < now() - interval '2 days';
end $$;

create function public.claim_notification_jobs(p_limit integer, p_listing uuid default null) returns setof public.notification_jobs
language sql set search_path = '' as $$
  update public.notification_jobs j set available_at = now() + interval '10 minutes', attempts = attempts + 1
  where j.id in (
    select q.id from public.notification_jobs q where q.sent_at is null and q.available_at <= now() and q.attempts < 10
      and (p_listing is null or q.listing_id = p_listing)
    order by q.created_at limit least(greatest(p_limit, 1), 20) for update skip locked
  ) returning j.*;
$$;

revoke all on function public.consume_submission_quota(text, integer), public.submit_listing_report(uuid, text, text), public.submit_listing_with_owner(jsonb, text), public.confirm_listing_owner(uuid, timestamptz, boolean), public.run_listing_lifecycle(), public.claim_notification_jobs(integer, uuid) from public, anon, authenticated;
grant execute on function public.consume_submission_quota(text, integer), public.submit_listing_report(uuid, text, text), public.submit_listing_with_owner(jsonb, text), public.confirm_listing_owner(uuid, timestamptz, boolean), public.run_listing_lifecycle(), public.claim_notification_jobs(integer, uuid) to service_role;
commit;
