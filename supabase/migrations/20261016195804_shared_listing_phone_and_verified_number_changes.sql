-- Keep the existing call number as the single listing contact.
update public.listings set whatsapp_number=contact_phone where whatsapp_number is distinct from contact_phone;
alter table public.listings add constraint listings_shared_phone_check check (whatsapp_number is not distinct from contact_phone);

create or replace function account_verification_private.validate_listing_phone(p_actor uuid,p_phone text)
returns void language plpgsql set search_path='' as $function$
declare expected text;
begin
 perform account_verification_private.require_account(p_actor);
 if exists(select 1 from public.admin_users where user_id=p_actor) then return;end if;
 select case when phone_confirmed_at is not null then account_verification_private.normal_phone(phone) end into expected from auth.users where id=p_actor;
 if expected is not null and expected is distinct from account_verification_private.normal_phone(p_phone) then
  raise exception 'Use your verified Phone / WhatsApp number. Change it in account settings first.';
 end if;
end $function$;
revoke all on function account_verification_private.validate_listing_phone(uuid,text) from public,anon,authenticated;
grant execute on function account_verification_private.validate_listing_phone(uuid,text) to service_role;

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
   rent_negotiable=coalesce((p_data->>'rent_negotiable')::boolean,false),rent_monthly=(p_data->>'rent_monthly')::integer,deposit=(p_data->>'deposit')::integer,district=p_data->>'district',locality=p_data->>'locality',landmark=p_data->>'landmark',contact_name=p_data->>'contact_name',contact_phone=p_data->>'contact_phone',whatsapp_number=p_data->>'whatsapp_number',
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

CREATE OR REPLACE FUNCTION public.submit_account_listing(p_listing jsonb, p_user uuid, p_email text, p_request uuid, p_management_hash text)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare new_id uuid;
begin
 perform account_verification_private.require_account(p_user);
 if p_request is null then raise exception 'Confirmed account required';end if;
 perform account_verification_private.sync_auth_contacts(p_user);
 select listing_id into new_id from public.listing_management_keys where verified_user=p_user and submission_id=p_request;
 if found then return new_id;end if;
 perform account_verification_private.validate_listing_phone(p_user,p_listing->>'contact_phone');
 new_id:=public.submit_managed_listing(p_listing,null,p_management_hash);
 update public.listing_management_keys set verified_user=p_user,submission_id=p_request where listing_id=new_id;
 -- Reads confirmed contact details from Auth; p_email is retained only for API compatibility.
 perform account_verification_private.sync_auth_contacts(p_user);
 perform account_verification_private.queue_listing_publication(new_id,p_user);
 return new_id;
exception when unique_violation then
 select listing_id into new_id from public.listing_management_keys where verified_user=p_user and submission_id=p_request;
 if found then return new_id;end if;
 raise;
end $function$
;

create or replace function public.account_apply_verified_phone(p_actor uuid)
returns integer language plpgsql set search_path='' as $function$
declare number text; changed integer;
begin
 perform account_verification_private.require_account(p_actor);
 select account_verification_private.normal_phone(phone) into number from auth.users where id=p_actor and phone_confirmed_at is not null;
 if number is null then raise exception 'Verify your new number first';end if;
 perform account_verification_private.sync_auth_contacts(p_actor);
 update public.listings l set contact_phone=right(number,10),whatsapp_number=right(number,10)
 from public.listing_management_keys k where k.listing_id=l.id and k.verified_user=p_actor and k.removed_at is null
 and (l.contact_phone is distinct from right(number,10) or l.whatsapp_number is distinct from right(number,10));
 get diagnostics changed=row_count;
 return changed;
end $function$;
revoke all on function public.account_apply_verified_phone(uuid) from public,anon,authenticated;
grant execute on function public.account_apply_verified_phone(uuid) to service_role;

-- Reject numbers held by another account, including pending changes, without exposing that account.
create or replace function public.account_phone_login_allowed(p_actor uuid,p_phone text)
returns boolean language sql set search_path='' as $function$
 select p_actor is not null and p_phone ~ '^\+91[6-9][0-9]{9}$'
 and not exists(select 1 from account_verification_private.phones where phone_e164=p_phone and verified_at is not null and user_id<>p_actor)
 and not exists(select 1 from auth.users u where u.id<>p_actor and (account_verification_private.normal_phone(u.phone)=p_phone or account_verification_private.normal_phone(u.phone_change)=p_phone));
$function$;

