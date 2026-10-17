alter table public.listings add column price_on_request boolean not null default false;
alter table public.listings add constraint listings_price_on_request_check check (not price_on_request or (rent_monthly=0 and rent_negotiable=false));
CREATE OR REPLACE FUNCTION public.manage_account_listing(p_user uuid, p_listing uuid, p_action text, p_data jsonb DEFAULT '{}'::jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare owned public.listing_management_keys; item public.listings;
begin
 select * into owned from public.listing_management_keys where listing_id=p_listing and verified_user=p_user for update;
 if not found then return false; end if;
 select * into item from public.listings where id=p_listing for update;
 if not found then return false; end if;
 if p_action='remove' then
  return public.remove_owned_listing(p_listing,owned.key_hash);
 elsif p_action='edit' then
  perform account_verification_private.validate_listing_phone(p_user,p_data->>'contact_phone');
  if owned.removed_at is not null then raise exception 'Removed listings cannot be edited'; end if;
  update public.listings set title=p_data->>'title',description=p_data->>'description',category=p_data->>'category',commercial_type=p_data->>'commercial_type',advertiser_type=p_data->>'advertiser_type',area_sqft=nullif(p_data->>'area_sqft','')::integer,
   price_on_request=coalesce((p_data->>'price_on_request')::boolean,false),rent_negotiable=case when coalesce((p_data->>'price_on_request')::boolean,false) then false else coalesce((p_data->>'rent_negotiable')::boolean,false) end,rent_monthly=case when coalesce((p_data->>'price_on_request')::boolean,false) then 0 else (p_data->>'rent_monthly')::integer end,deposit=(p_data->>'deposit')::integer,district=p_data->>'district',locality=p_data->>'locality',landmark=p_data->>'landmark',contact_name=p_data->>'contact_name',contact_phone=p_data->>'contact_phone',whatsapp_number=p_data->>'whatsapp_number',
   images=array(select jsonb_array_elements_text(p_data->'images')),amenities=array(select jsonb_array_elements_text(p_data->'amenities')),
   phone_verified_at=case when contact_phone=p_data->>'contact_phone' then phone_verified_at else null end where id=p_listing;
  return true;
 elsif p_action='renew' then
  if owned.removed_at is not null or item.moderation_status<>'approved' then raise exception 'Listing is unavailable for renewal'; end if;
  -- Renew near expiry, so repeated clicks cannot extend or shorten arbitrary cycles.
  if item.expires_at>now()+interval '3 days' then raise exception 'Renewal opens three days before expiry'; end if;
  update public.listings set expires_at=now()+interval '30 days',is_active=true where id=p_listing;
  update public.listing_owner_contacts set cycle=now()+interval '30 days' where listing_id=p_listing;
  return true;
 end if;
 raise exception 'Unknown action';
end $function$
;
CREATE OR REPLACE FUNCTION public.submit_listing_with_owner(p_listing jsonb, p_email text)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare new_id uuid; deadline timestamptz;
begin
  insert into public.listings(title, description, category, price_on_request, rent_negotiable, rent_monthly, deposit, district, locality, landmark, contact_name, contact_phone, whatsapp_number, amenities, images, is_active, is_featured, moderation_status)
  values(p_listing->>'title', p_listing->>'description', p_listing->>'category', coalesce((p_listing->>'price_on_request')::boolean,false), case when coalesce((p_listing->>'price_on_request')::boolean,false) then false else coalesce((p_listing->>'rent_negotiable')::boolean,false) end, case when coalesce((p_listing->>'price_on_request')::boolean,false) then 0 else (p_listing->>'rent_monthly')::integer end, (p_listing->>'deposit')::integer, p_listing->>'district', p_listing->>'locality', p_listing->>'landmark', p_listing->>'contact_name', p_listing->>'contact_phone', p_listing->>'whatsapp_number', array(select jsonb_array_elements_text(p_listing->'amenities')), array(select jsonb_array_elements_text(p_listing->'images')), false, false, 'pending')
  returning id, expires_at into new_id, deadline;
  p_email := nullif(btrim(p_email), '');
  if p_email is not null then
  insert into public.listing_owner_contacts(listing_id, email, cycle) values(new_id, p_email, deadline);
  insert into public.notification_jobs(dedupe_key, listing_id, kind, recipient, cycle, subject, body)
    values('verify:' || new_id, new_id, 'verify', p_email, deadline, 'Confirm your ToLet Odisha listing email', 'Confirm this email address for your listing. Your listing requires administrator approval and expires after 30 days. If you did not submit a listing, ignore this email.');
  end if;
  return new_id;
end $function$
;

