
-- MSG91 proofs and Supabase session exchange are deliberately server-only.
create table account_verification_private.sms_phones (
 user_id uuid primary key references auth.users(id) on delete cascade,
 phone_e164 text not null unique check(phone_e164 ~ '^\+91[6-9][0-9]{9}$'),
 verified_at timestamptz not null default now()
);
create table account_verification_private.sms_challenges (
 id uuid primary key default gen_random_uuid(), nonce_hash text not null unique,
 phone_e164 text not null check(phone_e164 ~ '^\+91[6-9][0-9]{9}$'),
 actor uuid references auth.users(id) on delete cascade, purpose text not null check(purpose in ('login','link')),
 created_at timestamptz not null default now(),expires_at timestamptz not null default now()+interval '15 minutes',used_at timestamptz
);
create index sms_challenge_phone_time on account_verification_private.sms_challenges(phone_e164,created_at);
create table account_verification_private.sms_proofs (
 token_hash text primary key check(length(token_hash)=64),created_at timestamptz not null default now()
);
create table account_verification_private.sms_session_exchange (
 actor uuid primary key references auth.users(id) on delete cascade,phone_e164 text not null unique,
 nonce_hash text not null,encrypted_otp text,expires_at timestamptz not null
);
create table account_verification_private.whatsapp_otp_receipts (
 actor uuid primary key references auth.users(id) on delete cascade,phone_e164 text not null,
 code_hash text not null,expires_at timestamptz not null
);
alter table account_verification_private.sms_phones enable row level security;
alter table account_verification_private.sms_challenges enable row level security;
alter table account_verification_private.sms_proofs enable row level security;
alter table account_verification_private.sms_session_exchange enable row level security;
alter table account_verification_private.whatsapp_otp_receipts enable row level security;
revoke all on account_verification_private.sms_phones,account_verification_private.sms_challenges,account_verification_private.sms_proofs,account_verification_private.sms_session_exchange,account_verification_private.whatsapp_otp_receipts from public,anon,authenticated;
grant all on account_verification_private.sms_phones,account_verification_private.sms_challenges,account_verification_private.sms_proofs,account_verification_private.sms_session_exchange,account_verification_private.whatsapp_otp_receipts to service_role;

create function public.sms_auth_begin(p_nonce text,p_phone text,p_actor uuid,p_purpose text) returns uuid
language plpgsql set search_path='' as $$
declare result uuid;
begin
 if p_nonce !~ '^[0-9a-f]{64}$' or p_phone !~ '^\+91[6-9][0-9]{9}$' or p_purpose not in ('login','link') or (p_purpose='link' and p_actor is null) then raise exception 'Invalid challenge';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_phone,311));
 if exists(select 1 from account_verification_private.sms_challenges where phone_e164=p_phone and created_at>now()-interval '60 seconds') then raise exception 'Wait 60 seconds before requesting another code';end if;
 if p_actor is not null then perform account_verification_private.require_account(p_actor);end if;
 if not public.consume_submission_quota('sms-start:'||encode(extensions.digest(p_phone,'sha256'),'hex'),5) or not public.consume_submission_quota('sms-start-global',100) then raise exception 'Too many requests';end if;
 insert into account_verification_private.sms_challenges(nonce_hash,phone_e164,actor,purpose) values(p_nonce,p_phone,p_actor,p_purpose) returning id into result;
 delete from account_verification_private.sms_session_exchange where expires_at<now();
 delete from account_verification_private.whatsapp_otp_receipts where expires_at<now();
 delete from account_verification_private.sms_challenges where expires_at<now()-interval '1 day';
 -- Provider tokens expire before this retention window. Keep hashes, never raw proofs.
 -- Keep proof hashes to reject replay even if the provider changes token lifetime.
 return result;
end $$;
create function public.sms_auth_challenge(p_id uuid,p_nonce text,p_actor uuid) returns table(phone_e164 text,purpose text)
language sql set search_path='' as $$
 select c.phone_e164,c.purpose from account_verification_private.sms_challenges c where c.id=p_id and c.nonce_hash=p_nonce and c.actor is not distinct from p_actor and c.expires_at>now() and c.used_at is null;
$$;
create function public.sms_auth_consume(p_id uuid,p_nonce text,p_actor uuid,p_phone text,p_proof text) returns boolean
language plpgsql set search_path='' as $$
begin
 perform 1 from account_verification_private.sms_challenges where id=p_id and nonce_hash=p_nonce and actor is not distinct from p_actor and phone_e164=p_phone and used_at is null and expires_at>now() for update;
 if not found or p_proof !~ '^[0-9a-f]{64}$' then return false;end if;
 begin insert into account_verification_private.sms_proofs(token_hash) values(p_proof);exception when unique_violation then return false;end;
 update account_verification_private.sms_challenges set used_at=now() where id=p_id;return true;
end $$;
-- The service validates the proof before invoking this helper. No public account lookup.
create function public.sms_auth_resolve(p_phone text,p_actor uuid default null)
returns table(user_id uuid,auth_phone text,whatsapp_phone text,sms_phone text)
language plpgsql security definer set search_path='' as $$
declare owner uuid; candidates uuid[];
begin
 select array_agg(distinct x.id) into candidates from (
 select s.user_id id from account_verification_private.sms_phones s where s.phone_e164=p_phone
 union select u.id from auth.users u where account_verification_private.normal_phone(u.phone)=p_phone or account_verification_private.normal_phone(u.phone_change)=p_phone
 union select p.user_id from account_verification_private.phones p where p.phone_e164=p_phone and p.verified_at is not null
 ) x;
 if cardinality(candidates)>1 or (p_actor is not null and cardinality(candidates)=1 and candidates[1]<>p_actor) then raise exception 'Number is already linked to another account';end if;
 owner:=coalesce(p_actor,candidates[1]);
 if owner is not null then
 return query select u.id,account_verification_private.normal_phone(u.phone),p.phone_e164,s.phone_e164 from auth.users u
 left join account_verification_private.phones p on p.user_id=u.id and p.verified_at is not null
 left join account_verification_private.sms_phones s on s.user_id=u.id
 where u.id=owner and coalesce(u.is_anonymous,false)=false;
 end if;
end $$;
create function public.sms_auth_record(p_actor uuid,p_phone text) returns void language plpgsql set search_path='' as $$
begin
 perform account_verification_private.require_account(p_actor);
 perform public.sms_auth_resolve(p_phone,p_actor);
 insert into account_verification_private.sms_phones(user_id,phone_e164) values(p_actor,p_phone)
 on conflict(user_id) do update set phone_e164=excluded.phone_e164,verified_at=now();
end $$;
create function public.sms_auth_status(p_actor uuid) returns table(phone_e164 text,verified_at timestamptz)
language sql set search_path='' as $$select s.phone_e164,s.verified_at from account_verification_private.sms_phones s where s.user_id=p_actor;$$;
-- A short-lived, encrypted hand-off lets Auth issue its own session after MSG91 proof.
-- It does not reset passwords, forge email confirmation, or issue custom JWTs.
create function public.sms_auth_exchange_begin(p_actor uuid,p_phone text,p_nonce text) returns void
language plpgsql security definer set search_path='' as $$
begin
 if p_nonce !~ '^[0-9a-f]{64}$' or not exists(select 1 from account_verification_private.sms_phones where user_id=p_actor) or not exists(select 1 from auth.users where id=p_actor and account_verification_private.normal_phone(phone)=p_phone and phone_confirmed_at is not null) then raise exception 'Invalid session exchange';end if;
 delete from account_verification_private.sms_session_exchange where expires_at<now();
 if exists(select 1 from account_verification_private.sms_session_exchange where actor=p_actor or phone_e164=p_phone) then raise exception 'Sign-in already in progress';end if;
 insert into account_verification_private.sms_session_exchange(actor,phone_e164,nonce_hash,expires_at) values(p_actor,p_phone,p_nonce,now()+interval '30 seconds');
end $$;
create function public.sms_auth_exchange_capture(p_actor uuid,p_phone text,p_cipher text) returns boolean language plpgsql set search_path='' as $$
begin
 update account_verification_private.sms_session_exchange set encrypted_otp=coalesce(encrypted_otp,p_cipher) where actor=p_actor and phone_e164=p_phone and expires_at>now();
 return found;
end $$;
create function public.sms_auth_exchange_take(p_actor uuid,p_nonce text) returns text language plpgsql set search_path='' as $$
declare result text;
begin
 delete from account_verification_private.sms_session_exchange where actor=p_actor and nonce_hash=p_nonce and expires_at>now() returning encrypted_otp into result;return result;
end $$;
create function public.sms_auth_exchange_cancel(p_actor uuid,p_nonce text) returns void language sql set search_path='' as $$delete from account_verification_private.sms_session_exchange where actor=p_actor and nonce_hash=p_nonce;$$;
create function public.account_record_whatsapp_otp(p_actor uuid,p_phone text,p_hash text) returns void language sql set search_path='' as $$
 insert into account_verification_private.whatsapp_otp_receipts(actor,phone_e164,code_hash,expires_at) values(p_actor,p_phone,p_hash,now()+interval '15 minutes') on conflict(actor) do update set phone_e164=excluded.phone_e164,code_hash=excluded.code_hash,expires_at=excluded.expires_at;
$$;
create function public.account_confirm_whatsapp_otp(p_actor uuid,p_phone text,p_hash text) returns boolean
language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from auth.users where id=p_actor and phone_confirmed_at is not null and account_verification_private.normal_phone(phone)=p_phone) then return false;end if;
 delete from account_verification_private.whatsapp_otp_receipts where actor=p_actor and phone_e164=p_phone and code_hash=p_hash and expires_at>now();
 if not found then return false;end if;
 if public.account_phone_login_allowed(p_actor,p_phone) is not true then return false;end if;
 insert into account_verification_private.phones(user_id,phone_e164,verified_at) values(p_actor,p_phone,now()) on conflict(user_id) do update set phone_e164=excluded.phone_e164,verified_at=excluded.verified_at;
 perform account_verification_private.sync_listing(listing_id) from public.listing_management_keys where verified_user=p_actor;return true;
end $$;
-- Explicit grants only: none of these endpoints may be invoked with a browser key.
do $$declare f record;begin
 for f in select p.oid::regprocedure name from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and (p.proname like 'sms_auth_%' or p.proname in ('account_record_whatsapp_otp','account_confirm_whatsapp_otp')) loop
 execute format('revoke all on function %s from public,anon,authenticated',f.name);
 execute format('grant execute on function %s to service_role',f.name);
 end loop;
end $$;

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
 if u.phone_confirmed_at is not null and not exists(select 1 from account_verification_private.sms_phones s where s.user_id=p_actor) then
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

-- Add a separate public call-number badge; the legacy phone_verified badge remains WhatsApp.
alter table public.listings add column sms_verified_at timestamptz;
alter table public.listings add column call_verified boolean generated always as (sms_verified_at is not null) stored;
alter table public.listings drop constraint if exists listings_shared_phone_check;
create or replace function account_verification_private.validate_listing_phone(p_actor uuid,p_phone text) returns void
language plpgsql set search_path='' as $$
declare expected text;
begin
 perform account_verification_private.require_account(p_actor);
 if exists(select 1 from public.admin_users where user_id=p_actor) then return;end if;
 select phone_e164 into expected from account_verification_private.sms_phones where user_id=p_actor;
 if expected is not null and expected is distinct from account_verification_private.normal_phone(p_phone) then raise exception 'Use your verified Phone number. Change it in account settings first.';end if;
end $$;
create or replace function account_verification_private.sync_listing(p_listing uuid) returns void language plpgsql set search_path='' as $$
declare actor uuid;
begin
 select verified_user into actor from public.listing_management_keys where listing_id=p_listing;
 if actor is not null then perform account_verification_private.refresh_id_retention(actor);end if;
 update public.listings l set
 phone_verified_at=(select p.verified_at from account_verification_private.phones p where p.user_id=actor and p.phone_e164=account_verification_private.normal_phone(coalesce(nullif(l.whatsapp_number,''),l.contact_phone))),
 sms_verified_at=(select s.verified_at from account_verification_private.sms_phones s where s.user_id=actor and s.phone_e164=account_verification_private.normal_phone(l.contact_phone)),
 id_verified=exists(select 1 from account_verification_private.government_ids d where d.user_id=actor and d.status='approved' and d.object_path is not null) where l.id=p_listing;
end $$;
create or replace function account_verification_private.listing_phone_changed() returns trigger language plpgsql set search_path='' as $$
declare actor uuid;
begin
 select verified_user into actor from public.listing_management_keys where listing_id=new.id;
 if actor is not null then
 select verified_at into new.phone_verified_at from account_verification_private.phones where user_id=actor and phone_e164=account_verification_private.normal_phone(coalesce(nullif(new.whatsapp_number,''),new.contact_phone));
 select verified_at into new.sms_verified_at from account_verification_private.sms_phones where user_id=actor and phone_e164=account_verification_private.normal_phone(new.contact_phone);
 end if;return new;
end $$;
create function account_verification_private.sms_contact_changed() returns trigger language plpgsql set search_path='' as $$
begin
 perform account_verification_private.sync_listing(listing_id) from public.listing_management_keys where verified_user=coalesce(new.user_id,old.user_id);return null;
end $$;
create trigger sms_contact_badges after insert or update or delete on account_verification_private.sms_phones for each row execute function account_verification_private.sms_contact_changed();
revoke all on function account_verification_private.sms_contact_changed() from public,anon,authenticated;
grant execute on function account_verification_private.sms_contact_changed() to service_role;
-- Applying a WhatsApp number must never overwrite the independently verified call number.
create or replace function public.account_apply_verified_phone(p_actor uuid) returns integer language plpgsql set search_path='' as $$
declare number text; changed integer;
begin
 perform account_verification_private.require_account(p_actor);
 select phone_e164 into number from account_verification_private.phones where user_id=p_actor and verified_at is not null;
 if number is null then raise exception 'Verify your WhatsApp number first';end if;
 update public.listings l set whatsapp_number=right(number,10) from public.listing_management_keys k where k.listing_id=l.id and k.verified_user=p_actor and k.removed_at is null and l.whatsapp_number is distinct from right(number,10);
 get diagnostics changed=row_count;return changed;
end $$;
create or replace function public.account_phone_login_allowed(p_actor uuid,p_phone text) returns boolean language sql set search_path='' as $$
 select p_actor is not null and p_phone ~ '^\+91[6-9][0-9]{9}$'
 and not exists(select 1 from account_verification_private.sms_phones where phone_e164=p_phone and user_id<>p_actor)
 and not exists(select 1 from account_verification_private.phones where phone_e164=p_phone and verified_at is not null and user_id<>p_actor)
 and not exists(select 1 from auth.users u where u.id<>p_actor and (account_verification_private.normal_phone(u.phone)=p_phone or account_verification_private.normal_phone(u.phone_change)=p_phone));
$$;
