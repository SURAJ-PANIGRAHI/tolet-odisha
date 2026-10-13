begin;
alter table public.listings add column commercial_type text, add column area_sqft integer;
alter table public.listings drop constraint listings_category_check;
alter table public.listings add constraint listings_category_check check (category in ('Boys Mess','Girls Hostel','Ladies Mess','Paying Guest (PG)','Bachelor Room','1 BHK Flat','2 BHK Flat','Family House','Commercial / Shop','Tutor / Tuition'));
alter table public.listings add constraint listings_area_sqft_check check (area_sqft is null or area_sqft between 1 and 10000000);
-- Legacy commercial ads can retain unknown type/area. New submissions require both in the API.
alter table public.listings add constraint listings_commercial_type_check check (commercial_type is null or (category='Commercial / Shop' and area_sqft is not null and commercial_type in ('Office Space','Shop / Showroom','Bank / ATM Space','Warehouse / Godown','Other Commercial')));
create or replace function public.submit_managed_listing(p_listing jsonb, p_email text, p_management_hash text) returns uuid
language plpgsql set search_path = '' as $$
declare new_id uuid;
begin
  new_id := public.submit_listing_with_owner(p_listing, p_email);
  insert into public.listing_management_keys(listing_id,key_hash) values(new_id,p_management_hash);
  update public.listings set moderation_status='approved',is_active=true,
    commercial_type=nullif(p_listing->>'commercial_type',''),
    area_sqft=nullif(p_listing->>'area_sqft','')::integer where id=new_id;
  update public.notification_jobs set body='Confirm this email address to display the Email verified badge on your ToLet Odisha listing. Your listing is live and expires after 30 days. Verified email addresses receive a reminder three days before expiry. If you did not submit a listing, ignore this email.' where listing_id=new_id and kind='verify';
  return new_id;
end $$;

revoke all on function public.submit_managed_listing(jsonb,text,text) from public, anon, authenticated;
grant execute on function public.submit_managed_listing(jsonb,text,text) to service_role;
commit;
