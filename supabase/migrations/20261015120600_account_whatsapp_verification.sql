begin;
grant usage on schema extensions to service_role;
-- Standalone verification for the existing account-owned listings. No portal-v2 dependency.
create schema account_verification_private;
revoke all on schema account_verification_private from public,anon,authenticated;
grant usage on schema account_verification_private to service_role;
create table account_verification_private.phones(
 user_id uuid primary key references auth.users(id) on delete cascade,
 phone_e164 text not null check(phone_e164 ~ '^\+91[6-9][0-9]{9}$'),
 verified_at timestamptz
);
create unique index account_verified_phone_unique on account_verification_private.phones(phone_e164) where verified_at is not null;
create table account_verification_private.challenges(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 phone_e164 text not null,nonce_hash bytea not null,
 created_at timestamptz not null default now(),expires_at timestamptz not null default now()+interval '30 minutes',used_at timestamptz
);
create index account_phone_challenge_owner on account_verification_private.challenges(user_id,created_at);
create table account_verification_private.receipts(
 instance text not null,message_id text not null,
 user_id uuid references auth.users(id) on delete set null,
 received_at timestamptz not null default now(),primary key(instance,message_id)
);
create index account_phone_receipt_retention on account_verification_private.receipts(received_at);
alter table account_verification_private.phones enable row level security;
alter table account_verification_private.challenges enable row level security;
alter table account_verification_private.receipts enable row level security;
revoke all on all tables in schema account_verification_private from public,anon,authenticated;
grant all on all tables in schema account_verification_private to service_role;

create function account_verification_private.require_account(p_actor uuid) returns void
-- Private service-only helper: auth.users is not readable by the service Data API role.
-- The API validates p_actor with Auth getUser before calling these service-only RPCs.
language plpgsql security definer set search_path='' as $$
begin
 perform 1 from auth.users where id=p_actor and email_confirmed_at is not null and coalesce(is_anonymous,false)=false for update;
 if not found then raise exception 'Confirmed account required';end if;
end $$;

create function account_verification_private.normal_phone(value text) returns text
language sql immutable set search_path='' as $$
 select case when regexp_replace(value,'[^0-9]','','g') ~ '^[6-9][0-9]{9}$' then '+91'||regexp_replace(value,'[^0-9]','','g')
 when regexp_replace(value,'[^0-9]','','g') ~ '^91[6-9][0-9]{9}$' then '+'||regexp_replace(value,'[^0-9]','','g') else null end;
$$;

create function account_verification_private.sync_listing(p_listing uuid) returns void
language sql set search_path='' as $$
 update public.listings l set phone_verified_at=(
 select p.verified_at from account_verification_private.phones p
 join public.listing_management_keys k on k.verified_user=p.user_id
 where k.listing_id=l.id and p.phone_e164=account_verification_private.normal_phone(l.contact_phone)) where l.id=p_listing;
$$;

create function public.account_create_phone_challenge(p_actor uuid,p_phone text)
returns table(challenge_id uuid,verification_text text,valid_until timestamptz)
language plpgsql set search_path='' as $$
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
 not exists(select 1 from account_verification_private.phones p where p.user_id=p_actor and p.verified_at is not null and p.phone_e164=account_verification_private.normal_phone(l.contact_phone));
 nonce:=encode(extensions.gen_random_bytes(32),'hex');
 insert into account_verification_private.challenges(user_id,phone_e164,nonce_hash) values(p_actor,p_phone,extensions.digest(nonce,'sha256')) returning * into c;
 return query select c.id,'VERIFY_'||p_actor::text||'_'||nonce,c.expires_at;
end $$;

create function public.account_accept_whatsapp_verification(p_actor uuid,p_nonce text,p_sender text,p_instance text,p_message_id text,p_sent_at timestamptz default null) returns text
language plpgsql set search_path='' as $$
declare c account_verification_private.challenges;
begin
 if p_actor is null or p_nonce is null or p_nonce !~ '^[0-9a-f]{64}$' or p_sender is null or p_sender !~ '^\+91[6-9][0-9]{9}$' or coalesce(length(p_instance),0) not between 1 and 120 or coalesce(length(p_message_id),0) not between 1 and 200 then return 'ignored';end if;
 perform account_verification_private.require_account(p_actor);
 if exists(select 1 from account_verification_private.receipts where instance=p_instance and message_id=p_message_id) then return 'duplicate';end if;
 select * into c from account_verification_private.challenges where user_id=p_actor and nonce_hash=extensions.digest(p_nonce,'sha256') for update;
 if not found or c.used_at is not null or c.expires_at<=now() then return 'ignored';end if;
 if c.phone_e164<>p_sender or p_sent_at>now()+interval '5 minutes' or p_sent_at<c.created_at-interval '2 minutes' then return 'ignored';end if;
 if (select phone_e164 from account_verification_private.phones where user_id=p_actor) is distinct from c.phone_e164 then return 'ignored';end if;
 begin
  update account_verification_private.phones set verified_at=now() where user_id=p_actor;
 exception when unique_violation then return 'number_in_use';end;
 insert into account_verification_private.receipts(instance,message_id,user_id) values(p_instance,p_message_id,p_actor);
 update account_verification_private.challenges set used_at=now() where id=c.id;
 perform account_verification_private.sync_listing(listing_id) from public.listing_management_keys where verified_user=p_actor;
 return 'verified';
end $$;

create function public.account_phone_verification_status(p_actor uuid,p_challenge uuid default null)
returns table(verified boolean,phone_number text,challenge_status text,expires_at timestamptz)
language plpgsql set search_path='' as $$
declare c account_verification_private.challenges;
begin
 perform account_verification_private.require_account(p_actor);
 if p_challenge is not null then select * into c from account_verification_private.challenges where id=p_challenge and user_id=p_actor;end if;
 return query select coalesce(p.verified_at is not null,false),p.phone_e164,
 case when p_challenge is null then 'idle' when c.id is null then 'unknown' when c.used_at is not null then 'completed' when c.expires_at<=now() then 'expired' else 'pending' end,c.expires_at
 from (select p_actor as id) u left join account_verification_private.phones p on p.user_id=u.id;
end $$;

-- Recompute account badges on new ownership, claims, edits, and deletions of ownership.
create function account_verification_private.ownership_changed() returns trigger
language plpgsql set search_path='' as $$
begin
 perform account_verification_private.sync_listing(coalesce(new.listing_id,old.listing_id));return null;
end $$;
create trigger account_phone_ownership after insert or update of verified_user or delete on public.listing_management_keys for each row execute function account_verification_private.ownership_changed();
create function account_verification_private.listing_phone_changed() returns trigger
language plpgsql set search_path='' as $$
declare actor uuid;
begin
 select verified_user into actor from public.listing_management_keys where listing_id=new.id;
 if actor is not null then
  select verified_at into new.phone_verified_at from account_verification_private.phones where user_id=actor and phone_e164=account_verification_private.normal_phone(new.contact_phone);
 end if;
 return new;
end $$;
create trigger account_phone_listing_edit before update of contact_phone on public.listings for each row execute function account_verification_private.listing_phone_changed();
alter table public.listings add column phone_verified boolean generated always as (phone_verified_at is not null) stored;

create function public.account_prune_phone_verification() returns void language sql set search_path='' as $$
 delete from account_verification_private.receipts where received_at<now()-interval '30 days';
 delete from account_verification_private.challenges where created_at<now()-interval '2 days';
$$;
revoke all on all functions in schema account_verification_private from public,anon,authenticated;
grant execute on all functions in schema account_verification_private to service_role;
revoke all on function public.account_create_phone_challenge(uuid,text), public.account_accept_whatsapp_verification(uuid,text,text,text,text,timestamptz),public.account_phone_verification_status(uuid,uuid),public.account_prune_phone_verification() from public,anon,authenticated;
grant execute on function public.account_create_phone_challenge(uuid,text), public.account_accept_whatsapp_verification(uuid,text,text,text,text,timestamptz),public.account_phone_verification_status(uuid,uuid),public.account_prune_phone_verification() to service_role;
commit;
