begin;
-- Additive account ownership for the existing listing system. No old listing is reassigned.
alter table public.listing_management_keys add column if not exists submission_id uuid;
create index if not exists listing_management_account_idx on public.listing_management_keys(verified_user) where verified_user is not null;
create unique index if not exists listing_management_submission_unique on public.listing_management_keys(verified_user,submission_id) where submission_id is not null;

create function public.submit_account_listing(p_listing jsonb,p_user uuid,p_email text,p_request uuid,p_management_hash text) returns uuid
language plpgsql set search_path='' as $$
declare new_id uuid;
begin
 if p_user is null or p_request is null or nullif(btrim(p_email),'') is null then raise exception 'Confirmed account required'; end if;
 select listing_id into new_id from public.listing_management_keys where verified_user=p_user and submission_id=p_request;
 if found then return new_id; end if;
 new_id:=public.submit_managed_listing(p_listing,null,p_management_hash);
 update public.listing_management_keys set verified_user=p_user,submission_id=p_request where listing_id=new_id;
 insert into public.listing_owner_contacts(listing_id,email,verified_at,cycle)
 select id,lower(btrim(p_email)),now(),expires_at from public.listings where id=new_id;
 update public.listings set email_verified=true where id=new_id;
 return new_id;
exception when unique_violation then
 select listing_id into new_id from public.listing_management_keys where verified_user=p_user and submission_id=p_request;
 if found then return new_id; end if;
 raise;
end $$;

create function public.manage_account_listing(p_user uuid,p_listing uuid,p_action text,p_data jsonb default '{}'::jsonb) returns boolean
language plpgsql set search_path='' as $$
declare owned public.listing_management_keys; item public.listings;
begin
 select * into owned from public.listing_management_keys where listing_id=p_listing and verified_user=p_user for update;
 if not found then return false; end if;
 select * into item from public.listings where id=p_listing for update;
 if not found then return false; end if;
 if p_action='remove' then
  return public.remove_owned_listing(p_listing,owned.key_hash);
 elsif p_action='edit' then
  if owned.removed_at is not null then raise exception 'Removed listings cannot be edited'; end if;
  update public.listings set title=p_data->>'title',description=p_data->>'description',category=p_data->>'category',commercial_type=p_data->>'commercial_type',advertiser_type=p_data->>'advertiser_type',area_sqft=nullif(p_data->>'area_sqft','')::integer,
   rent_monthly=(p_data->>'rent_monthly')::integer,deposit=(p_data->>'deposit')::integer,district=p_data->>'district',locality=p_data->>'locality',landmark=p_data->>'landmark',contact_name=p_data->>'contact_name',contact_phone=p_data->>'contact_phone',whatsapp_number=p_data->>'whatsapp_number',
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
end $$;

create function public.claim_account_listing(p_user uuid,p_listing uuid,p_hash text) returns boolean
language plpgsql set search_path='' as $$
declare owned public.listing_management_keys;
begin
 if p_user is null then return false; end if;
 select * into owned from public.listing_management_keys where listing_id=p_listing and key_hash=p_hash for update;
 if not found or (owned.verified_user is not null and owned.verified_user<>p_user) then return false; end if;
 update public.listing_management_keys set verified_user=p_user where listing_id=p_listing;
 return true;
end $$;
revoke all on function public.submit_account_listing(jsonb,uuid,text,uuid,text),public.manage_account_listing(uuid,uuid,text,jsonb),public.claim_account_listing(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.submit_account_listing(jsonb,uuid,text,uuid,text),public.manage_account_listing(uuid,uuid,text,jsonb),public.claim_account_listing(uuid,uuid,text) to service_role;
commit;
