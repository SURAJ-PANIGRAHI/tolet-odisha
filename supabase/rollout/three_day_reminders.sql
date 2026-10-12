begin;
create or replace function public.confirm_listing_owner(p_listing uuid, p_cycle timestamptz, p_renew boolean) returns boolean
language plpgsql set search_path = '' as $$
declare listing public.listings; owner public.listing_owner_contacts; next_cycle timestamptz;
begin
  select * into listing from public.listings where id = p_listing for update;
  if not found or listing.moderation_status = 'rejected' then return false; end if;
  select * into owner from public.listing_owner_contacts where listing_id = p_listing for update;
  if not found or owner.cycle <> p_cycle or now() > p_cycle + interval '7 days' then return false; end if;
  if p_renew then
    -- Renew only approved listings near expiry; never undo a manual rejection/unpublish.
    if listing.moderation_status <> 'approved' or now() < listing.expires_at - interval '3 days' then return false; end if;
    next_cycle := now() + interval '30 days';
    update public.listings set expires_at = next_cycle, is_active = true where id = p_listing;
    update public.listing_owner_contacts set verified_at = coalesce(verified_at, now()), cycle = next_cycle where listing_id = p_listing;
  else
    update public.listing_owner_contacts set verified_at = coalesce(verified_at, now()) where listing_id = p_listing;
  end if;
  return true;
end $$;

create or replace function public.run_listing_lifecycle() returns void
language plpgsql set search_path = '' as $$
begin
  insert into public.notification_jobs(dedupe_key, listing_id, kind, recipient, cycle, subject, body)
  select 'renew:' || l.id || ':' || l.expires_at::text, l.id, 'renewal', c.email, c.cycle, 'Still available? Renew your ToLet Odisha listing',
    'Your listing "' || l.title || '" expires on ' || to_char(l.expires_at at time zone 'Asia/Kolkata', 'YYYY-MM-DD HH24:MI') || ' IST. Would you like to list it for another 30 days?'
  from public.listings l join public.listing_owner_contacts c on c.listing_id = l.id
  where l.moderation_status = 'approved' and l.is_active is true and c.verified_at is not null
    and l.expires_at > now() and l.expires_at <= now() + interval '3 days'
  on conflict(dedupe_key) do nothing;
  update public.listings set is_active = false where is_active is true and expires_at <= now();
  delete from public.submission_quotas where window_start < now() - interval '2 days';
end $$;

commit;
