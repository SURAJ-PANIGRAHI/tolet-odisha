begin;
alter table public.listings drop constraint listings_commercial_type_check;
alter table public.listings add constraint listings_commercial_type_check check (commercial_type is null or (category='Commercial / Shop' and commercial_type in ('Office Space','Shop / Showroom','Bank / ATM Space','Warehouse / Godown','Other Commercial')));
alter table public.listings add column advertiser_type text;
alter table public.listings add constraint listings_advertiser_type_check check (advertiser_type is null or advertiser_type in ('Owner','Broker','Third Party'));
-- Existing listings retain an unknown role. New API submissions require a self-declared role.
create or replace function public.submit_managed_listing(p_listing jsonb, p_email text, p_management_hash text) returns uuid
language plpgsql set search_path = '' as $$
declare new_id uuid;
begin
  new_id := public.submit_listing_with_owner(p_listing, p_email);
  insert into public.listing_management_keys(listing_id,key_hash) values(new_id,p_management_hash);
  update public.listings set moderation_status='approved',is_active=true,
    commercial_type=nullif(p_listing->>'commercial_type',''),
    advertiser_type=nullif(p_listing->>'advertiser_type',''),
    area_sqft=nullif(p_listing->>'area_sqft','')::integer where id=new_id;
  update public.notification_jobs set body='Confirm this email address to display the Email verified badge on your ToLet Odisha listing. Your listing is live and expires after 30 days. Verified email addresses receive a reminder three days before expiry. If you did not submit a listing, ignore this email.' where listing_id=new_id and kind='verify';
  return new_id;
end $$;

revoke all on function public.submit_managed_listing(jsonb,text,text) from public, anon, authenticated;
grant execute on function public.submit_managed_listing(jsonb,text,text) to service_role;

-- Counts are private: phone reuse is a repeat-advertiser signal, not proof of brokerage.
create or replace function public.count_listings_by_phone(p_phone text)
returns table(total_count bigint, active_count bigint)
language sql stable set search_path = '' as $$
  with normalized as (
    select regexp_replace(p_phone, '[^0-9]', '', 'g') as digits
  ), phone as (
    select case when digits ~ '^91[6-9][0-9]{9}$' then substring(digits from 3) else digits end as number from normalized
  )
  select count(*), count(*) filter (where l.is_active and l.expires_at > now())
  from public.listings l, phone p
  where p.number ~ '^[6-9][0-9]{9}$' and l.contact_phone = p.number;
$$;
revoke all on function public.count_listings_by_phone(text) from public, anon, authenticated;
grant execute on function public.count_listings_by_phone(text) to service_role;
commit;
