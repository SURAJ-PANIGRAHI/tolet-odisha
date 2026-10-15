begin;
-- Service-only access: identity comes from Auth getUser, never from browser input.
create or replace function account_verification_private.require_account(p_actor uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform 1 from auth.users where id=p_actor and coalesce(is_anonymous,false)=false and
 (email_confirmed_at is not null or (phone_confirmed_at is not null and phone ~ '^\+?91[6-9][0-9]{9}$')) for update;
 if not found then raise exception 'Confirmed account required';end if;
end $$;

create function account_verification_private.sync_auth_contacts(p_actor uuid) returns void
language plpgsql security definer set search_path='' as $$
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
  update public.listings l set phone_verified_at=case when account_verification_private.normal_phone(l.contact_phone)=number then u.phone_confirmed_at else null end from public.listing_management_keys k
  where k.listing_id=l.id and k.verified_user=p_actor and l.phone_verified_at is distinct from (case when account_verification_private.normal_phone(l.contact_phone)=number then u.phone_confirmed_at else null end);
 end if;
 update public.listings l set email_verified=(u.email_confirmed_at is not null and nullif(u.email,'') is not null) from public.listing_management_keys k
 where k.listing_id=l.id and k.verified_user=p_actor and l.email_verified is distinct from (u.email_confirmed_at is not null and nullif(u.email,'') is not null);
 if u.email_confirmed_at is not null and nullif(u.email,'') is not null then
  insert into public.listing_owner_contacts(listing_id,email,verified_at,cycle)
  select l.id,lower(u.email),u.email_confirmed_at,l.expires_at from public.listings l join public.listing_management_keys k on k.listing_id=l.id where k.verified_user=p_actor
  on conflict(listing_id) do update set email=excluded.email,verified_at=excluded.verified_at where public.listing_owner_contacts.email is distinct from excluded.email or public.listing_owner_contacts.verified_at is null;
 end if;
end $$;
create function public.account_sync_auth_contacts(p_actor uuid) returns void language sql set search_path='' as $$select account_verification_private.sync_auth_contacts(p_actor);$$;

-- Called only by the signed Auth delivery hook. Never merge or reassign existing accounts.
create function public.account_phone_login_allowed(p_actor uuid,p_phone text) returns boolean language sql set search_path='' as $$
 select p_actor is not null and p_phone ~ '^\+91[6-9][0-9]{9}$' and not exists(select 1 from account_verification_private.phones where phone_e164=p_phone and verified_at is not null and user_id<>p_actor);
$$;

create function public.account_allow_otp_delivery(p_actor uuid,p_phone text) returns text language plpgsql set search_path='' as $$
begin
 if public.account_phone_login_allowed(p_actor,p_phone) is not true then return 'conflict';end if;
 if not public.consume_submission_quota('whatsapp-otp:'||encode(extensions.digest(p_phone,'sha256'),'hex'),10) or not public.consume_submission_quota('whatsapp-otp-global',200) then return 'limited';end if;
 return 'allowed';
end $$;
revoke all on function public.account_allow_otp_delivery(uuid,text) from public,anon,authenticated;
grant execute on function public.account_allow_otp_delivery(uuid,text) to service_role;

create or replace function public.submit_account_listing(p_listing jsonb,p_user uuid,p_email text,p_request uuid,p_management_hash text) returns uuid
language plpgsql set search_path='' as $$
declare new_id uuid;
begin
 perform account_verification_private.require_account(p_user);
 if p_request is null then raise exception 'Confirmed account required';end if;
 perform account_verification_private.sync_auth_contacts(p_user);
 select listing_id into new_id from public.listing_management_keys where verified_user=p_user and submission_id=p_request;
 if found then return new_id;end if;
 new_id:=public.submit_managed_listing(p_listing,null,p_management_hash);
 update public.listing_management_keys set verified_user=p_user,submission_id=p_request where listing_id=new_id;
 -- Reads confirmed contact details from Auth; p_email is retained only for API compatibility.
 perform account_verification_private.sync_auth_contacts(p_user);
 return new_id;
exception when unique_violation then
 select listing_id into new_id from public.listing_management_keys where verified_user=p_user and submission_id=p_request;
 if found then return new_id;end if;
 raise;
end $$;
revoke all on function account_verification_private.require_account(uuid),account_verification_private.sync_auth_contacts(uuid),public.account_sync_auth_contacts(uuid),public.account_phone_login_allowed(uuid,text) from public,anon,authenticated;
grant execute on function account_verification_private.require_account(uuid),account_verification_private.sync_auth_contacts(uuid),public.account_sync_auth_contacts(uuid),public.account_phone_login_allowed(uuid,text) to service_role;
commit;
