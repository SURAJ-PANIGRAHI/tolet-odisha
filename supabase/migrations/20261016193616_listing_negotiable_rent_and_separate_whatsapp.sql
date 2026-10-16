alter table public.listings add column rent_negotiable boolean not null default false;

CREATE OR REPLACE FUNCTION account_verification_private.listing_phone_changed()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare actor uuid;
begin
 select verified_user into actor from public.listing_management_keys where listing_id=new.id;
 if actor is not null then
  select verified_at into new.phone_verified_at from account_verification_private.phones where user_id=actor and phone_e164=account_verification_private.normal_phone(coalesce(nullif(new.whatsapp_number,''),new.contact_phone));
 end if;
 return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.submit_listing_with_owner(p_listing jsonb, p_email text)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare new_id uuid; deadline timestamptz;
begin
  insert into public.listings(title, description, category, rent_negotiable, rent_monthly, deposit, district, locality, landmark, contact_name, contact_phone, whatsapp_number, amenities, images, is_active, is_featured, moderation_status)
  values(p_listing->>'title', p_listing->>'description', p_listing->>'category', coalesce((p_listing->>'rent_negotiable')::boolean,false), (p_listing->>'rent_monthly')::integer, (p_listing->>'deposit')::integer, p_listing->>'district', p_listing->>'locality', p_listing->>'landmark', p_listing->>'contact_name', p_listing->>'contact_phone', p_listing->>'whatsapp_number', array(select jsonb_array_elements_text(p_listing->'amenities')), array(select jsonb_array_elements_text(p_listing->'images')), false, false, 'pending')
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

CREATE OR REPLACE FUNCTION account_verification_private.sync_listing(p_listing uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare actor uuid;
begin
 select verified_user into actor from public.listing_management_keys where listing_id=p_listing;
 if actor is not null then perform account_verification_private.refresh_id_retention(actor);end if;
 update public.listings l set phone_verified_at=(select p.verified_at from account_verification_private.phones p where p.user_id=actor and p.phone_e164=account_verification_private.normal_phone(coalesce(nullif(l.whatsapp_number,''),l.contact_phone))),
 id_verified=exists(select 1 from account_verification_private.government_ids d where d.user_id=actor and d.status='approved' and d.object_path is not null) where l.id=p_listing;
end $function$
;

CREATE OR REPLACE FUNCTION public.account_create_phone_challenge(p_actor uuid, p_phone text)
 RETURNS TABLE(challenge_id uuid, verification_text text, valid_until timestamp with time zone)
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare nonce text; c account_verification_private.challenges;
begin
 perform account_verification_private.require_account(p_actor);
 if p_phone is null or p_phone !~ '^\+91[6-9][0-9]{9}$' then raise exception 'Invalid phone';end if;
 if (select count(*) from account_verification_private.challenges where user_id=p_actor and created_at>now()-interval '1 hour')>=5 then raise exception 'Try later';end if;
 -- Starting another challenge cancels earlier ones. Same-number reverification keeps an existing valid badge.
 update account_verification_private.challenges set used_at=now() where user_id=p_actor and used_at is null;
 insert into account_verification_private.phones(user_id,phone_e164) values(p_actor,p_phone)
 on conflict(user_id) do update set phone_e164=excluded.phone_e164,
 verified_at=case when phones.phone_e164=excluded.phone_e164 then phones.verified_at else null end;
 update public.listings l set phone_verified_at=null from public.listing_management_keys k
 where k.listing_id=l.id and k.verified_user=p_actor and
 not exists(select 1 from account_verification_private.phones p where p.user_id=p_actor and p.verified_at is not null and p.phone_e164=account_verification_private.normal_phone(coalesce(nullif(l.whatsapp_number,''),l.contact_phone)));
 nonce:=encode(extensions.gen_random_bytes(32),'hex');
 insert into account_verification_private.challenges(user_id,phone_e164,nonce_hash) values(p_actor,p_phone,extensions.digest(nonce,'sha256')) returning * into c;
 return query select c.id,'VERIFY_'||p_actor::text||'_'||nonce,c.expires_at;
end $function$
;

CREATE OR REPLACE FUNCTION account_verification_private.sync_auth_contacts(p_actor uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare u auth.users; number text;
begin
 perform account_verification_private.require_account(p_actor);
 select * into u from auth.users where id=p_actor;
 if u.phone_confirmed_at is not null then
  number:=account_verification_private.normal_phone(u.phone);
  if number is null then raise exception 'Unsupported phone';end if;
  if exists(select 1 from account_verification_private.phones where phone_e164=number and verified_at is not null and user_id<>p_actor) then raise exception 'Number belongs to another account';end if;
  insert into account_verification_private.phones(user_id,phone_e164,verified_at) values(p_actor,number,u.phone_confirmed_at)
  on conflict(user_id) do update set phone_e164=excluded.phone_e164,verified_at=excluded.verified_at
  where account_verification_private.phones.phone_e164 is distinct from excluded.phone_e164 or account_verification_private.phones.verified_at is distinct from excluded.verified_at;
  update public.listings l set phone_verified_at=case when account_verification_private.normal_phone(coalesce(nullif(l.whatsapp_number,''),l.contact_phone))=number then u.phone_confirmed_at else null end from public.listing_management_keys k
  where k.listing_id=l.id and k.verified_user=p_actor and l.phone_verified_at is distinct from (case when account_verification_private.normal_phone(coalesce(nullif(l.whatsapp_number,''),l.contact_phone))=number then u.phone_confirmed_at else null end);
 end if;
 update public.listings l set email_verified=(u.email_confirmed_at is not null and nullif(u.email,'') is not null) from public.listing_management_keys k
 where k.listing_id=l.id and k.verified_user=p_actor and l.email_verified is distinct from (u.email_confirmed_at is not null and nullif(u.email,'') is not null);
 if u.email_confirmed_at is not null and nullif(u.email,'') is not null then
  insert into public.listing_owner_contacts(listing_id,email,verified_at,cycle)
  select l.id,lower(u.email),u.email_confirmed_at,l.expires_at from public.listings l join public.listing_management_keys k on k.listing_id=l.id where k.verified_user=p_actor
  on conflict(listing_id) do update set email=excluded.email,verified_at=excluded.verified_at where public.listing_owner_contacts.email is distinct from excluded.email or public.listing_owner_contacts.verified_at is null;
 end if;
end $function$
;

drop trigger account_phone_listing_edit on public.listings;
create trigger account_phone_listing_edit before update of contact_phone,whatsapp_number on public.listings for each row execute function account_verification_private.listing_phone_changed();

update public.listings l set phone_verified_at=(select p.verified_at from public.listing_management_keys k join account_verification_private.phones p on p.user_id=k.verified_user where k.listing_id=l.id and p.phone_e164=account_verification_private.normal_phone(coalesce(nullif(l.whatsapp_number,''),l.contact_phone)));

