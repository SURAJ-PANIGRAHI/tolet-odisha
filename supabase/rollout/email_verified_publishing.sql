begin;
alter table public.listings add column email_verified boolean not null default false;
update public.listings l set email_verified=true from public.listing_owner_contacts c where c.listing_id=l.id and c.verified_at is not null;
create or replace function public.submit_managed_listing(p_listing jsonb, p_email text, p_management_hash text) returns uuid
language plpgsql set search_path = '' as $$
declare new_id uuid;
begin
  new_id := public.submit_listing_with_owner(p_listing, p_email);
  insert into public.listing_management_keys(listing_id,key_hash) values(new_id,p_management_hash);
  update public.listings set moderation_status='approved',is_active=true where id=new_id;
  update public.notification_jobs set body='Confirm this email address to display the Email verified badge on your ToLet Odisha listing. Your listing is live and expires after 30 days. Verified email addresses receive a reminder three days before expiry. If you did not submit a listing, ignore this email.' where listing_id=new_id and kind='verify';
  return new_id;
end $$;
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
  update public.listings set email_verified=true where id=p_listing;
  return true;
end $$;

commit;
