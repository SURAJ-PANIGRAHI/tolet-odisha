-- Portal v2: additive, review/staging first. Existing public.listings is untouched.
-- Expose public to the Data API; NEVER expose portal_private.
-- All portal_* mutation RPCs are service_role-only. Next.js MUST derive actor IDs
-- from a validated Supabase session, never from user-submitted IDs.
begin;
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
grant usage on schema extensions to service_role;
create schema portal_private;
revoke all on schema portal_private from public, anon, authenticated;
grant usage on schema portal_private to anon, authenticated, service_role;

create table portal_private.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table portal_private.admins enable row level security;
create function portal_private.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists
  (select 1 from portal_private.admins where user_id=(select auth.uid()));
$$;
revoke all on function portal_private.is_admin() from public, anon, authenticated;
grant execute on function portal_private.is_admin() to anon, authenticated, service_role;

-- Public-safe profile attributes only. No emails, raw phones or ID paths here.
create table public.portal_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '' check (length(display_name)<=120),
  is_email_verified boolean not null default false,
  is_phone_verified boolean not null default false,
  is_id_verified boolean not null default false,
  id_reviewed_at timestamptz,
  multi_listing_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table portal_private.contacts (
  user_id uuid primary key references public.portal_profiles(user_id) on delete cascade,
  phone_e164 text check (phone_e164 ~ '^\+91[6-9][0-9]{9}$'),
  phone_verified_at timestamptz
);
-- Unverified claims cannot reserve someone else's number. Uniqueness applies only after review.
create unique index portal_verified_phone_unique on portal_private.contacts(phone_e164) where phone_verified_at is not null;
create table public.portal_listings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.portal_profiles(user_id) on delete cascade,
  title text not null check (length(btrim(title)) between 3 and 200),
  description text not null default '' check (length(description)<=5000),
  category text not null check (category in ('Boys Mess','Girls Hostel','Ladies Mess','Paying Guest (PG)','Bachelor Room','1 BHK Flat','2 BHK Flat','Family House','Commercial / Shop','Tutor / Tuition')),
  commercial_type text check (commercial_type in ('Office Space','Shop / Showroom','Bank / ATM Space','Warehouse / Godown','Other Commercial')),
  advertiser_type text not null check (advertiser_type in ('Owner','Broker','Third Party')),
  area_sqft integer check (area_sqft between 1 and 10000000),
  rent_monthly integer not null check (rent_monthly between 0 and 10000000),
  district text not null check (length(btrim(district)) between 1 and 100),
  locality text not null check (length(btrim(locality)) between 1 and 200),
  landmark text check (length(landmark)<=200),
  images text[] not null default '{}' check (cardinality(images)<=10),
  is_active boolean not null default true,
  moderation_status text not null default 'approved' check (moderation_status in ('approved','quarantined','rejected')),
  inactive_reason text check (inactive_reason in ('owner','expired','reports','plan_expired','admin')),
  inactive_since timestamptz,
  requires_multi_plan boolean not null default false,
  boost_expires_at timestamptz,
  report_count integer not null default 0 check (report_count>=0),
  created_at timestamptz not null default now() check (created_at<=now()),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default (now()+interval '30 days'),
  check ((category='Commercial / Shop' and commercial_type is not null) or (category<>'Commercial / Shop' and commercial_type is null))
);
create index portal_listings_owner_active on public.portal_listings(user_id,created_at,id) where is_active;
create index portal_listings_expiry on public.portal_listings(expires_at) where is_active;
create index portal_listings_search on public.portal_listings(district,category,created_at desc) where is_active;

create table portal_private.phone_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.portal_profiles(user_id) on delete cascade,
  phone_e164 text not null check (phone_e164 ~ '^\+91[6-9][0-9]{9}$'),
  nonce_hash bytea not null unique,
  expires_at timestamptz not null default (now()+interval '30 minutes'),
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index portal_phone_challenges_owner on portal_private.phone_challenges(user_id,created_at desc);
create table portal_private.id_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.portal_profiles(user_id) on delete cascade,
  document_type text not null check (document_type in ('masked_aadhaar','voter_id','driving_licence')),
  account_name_at_submission text not null,
  -- A private Storage object KEY, never a public/signed URL.
  id_document_url text unique,
  status text not null default 'pending' check (status in ('pending','approved','rejected','deleting','deleted')),
  rejection_reason text check (rejection_reason in ('Blurry image','Name mismatch','Incomplete ID')),
  consent_version text not null,
  consent_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  check (id_document_url is null or (id_document_url like user_id::text||'/%' and length(id_document_url)<=500))
);
create unique index portal_one_live_id_document on portal_private.id_documents(user_id)
  where id_document_url is not null;
create table public.portal_payment_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.portal_profiles(user_id) on delete set null,
  listing_id uuid references public.portal_listings(id) on delete set null,
  kind text not null check (kind in ('boost','multi_listing')),
  amount_paise integer generated always as (case when kind='boost' then 2900 else 4900 end) stored,
  currency text not null default 'INR' check (currency='INR'),
  -- Claims can collide; a fake claim must not reserve another payer's real UTR.
  claimed_utr text check (claimed_utr ~ '^[0-9]{12}$'),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  entitlement_until timestamptz,
  rejection_reason text check (length(rejection_reason)<=300)
);
create index portal_payment_requests_owner on public.portal_payment_requests(user_id,created_at desc);
create table portal_private.bank_receipts (
  utr text primary key check (utr ~ '^[0-9]{12}$'),
  payment_request_id uuid not null unique references public.portal_payment_requests(id),
  amount_paise integer not null check (amount_paise in (2900,4900)),
  bank_received_at timestamptz not null,
  approved_by uuid references auth.users(id) on delete set null,
  checked_at timestamptz not null default now()
);
create table public.portal_reports (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.portal_listings(id) on delete cascade,
  reporter_id uuid not null references public.portal_profiles(user_id) on delete cascade,
  reason text not null check (reason in ('Fake listing','Scam / Fraud','Wrong contact number','Already rented','Misleading photos','Wrong information','Duplicate listing','Other')),
  description text not null default '' check (length(description)<=2000),
  status text not null default 'open' check (status in ('open','resolved','dismissed')),
  created_at timestamptz not null default now(),
  unique(listing_id,reporter_id)
);
create index portal_reports_owner_time on public.portal_reports(reporter_id,created_at);
create index portal_reports_open on public.portal_reports(listing_id) where status='open';
create table portal_private.renewal_tokens (
  token_hash bytea primary key,
  listing_id uuid not null references public.portal_listings(id) on delete cascade,
  user_id uuid not null references public.portal_profiles(user_id) on delete cascade,
  cycle timestamptz not null,
  expires_at timestamptz not null,
  used_at timestamptz
);
create index portal_renewal_tokens_listing on portal_private.renewal_tokens(listing_id);
-- Durable outbox remains after auth/profile deletion so files are not orphaned.
create table portal_private.cleanup_jobs (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references portal_private.id_documents(id) on delete set null,
  user_id uuid not null,
  object_path text not null unique,
  due_at timestamptz not null,
  state text not null default 'pending' check (state in ('pending','processing','complete')),
  claim_token uuid,
  leased_until timestamptz,
  attempts integer not null default 0,
  completed_at timestamptz,
  last_error text
);
create index portal_cleanup_due on portal_private.cleanup_jobs(due_at) where state<>'complete';
create table portal_private.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid,
  action text not null,
  target_id uuid,
  created_at timestamptz not null default now()
);

-- RLS plus narrow grants: clients cannot write protected flags or entitlement fields.
alter table public.portal_profiles enable row level security;
alter table public.portal_listings enable row level security;
alter table public.portal_payment_requests enable row level security;
alter table public.portal_reports enable row level security;
create policy portal_profiles_public_read on public.portal_profiles for select to anon,authenticated using (true);
create policy portal_profiles_own_name on public.portal_profiles for update to authenticated
  using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
create policy portal_listings_public_read on public.portal_listings for select to anon,authenticated using (
  is_active and moderation_status='approved' and expires_at>now() and
  (not requires_multi_plan or exists(select 1 from public.portal_profiles p where p.user_id=portal_listings.user_id and p.multi_listing_expires_at>now()))
);
create policy portal_listings_owner_admin_read on public.portal_listings for select to authenticated
  using (user_id=(select auth.uid()) or (select portal_private.is_admin()));
create policy portal_payments_owner_admin_read on public.portal_payment_requests for select to authenticated
  using (user_id=(select auth.uid()) or (select portal_private.is_admin()));
create policy portal_reports_owner_admin_read on public.portal_reports for select to authenticated
  using (reporter_id=(select auth.uid()) or (select portal_private.is_admin()));
revoke all on public.portal_profiles, public.portal_listings,public.portal_payment_requests,public.portal_reports from public,anon,authenticated;
grant select on public.portal_profiles,public.portal_listings to anon,authenticated;
grant update(display_name) on public.portal_profiles to authenticated;
grant select on public.portal_payment_requests,public.portal_reports to authenticated;
grant all on public.portal_profiles,public.portal_listings,public.portal_payment_requests,public.portal_reports to service_role;

-- Private tables are service-only except admin-authorised SQL access to ID metadata.
do $$ declare t text; begin
  foreach t in array array['contacts','phone_challenges','id_documents','bank_receipts','renewal_tokens','cleanup_jobs','audit_log'] loop
    execute format('alter table portal_private.%I enable row level security',t);
    execute format('revoke all on portal_private.%I from public,anon,authenticated',t);
    execute format('grant all on portal_private.%I to service_role',t);
  end loop;
end $$;
grant all on portal_private.admins to service_role;
grant usage,select on all sequences in schema portal_private to service_role;
create policy portal_id_admin_read on portal_private.id_documents for select to authenticated using ((select portal_private.is_admin()));
grant select on portal_private.id_documents to authenticated;

-- Auth truth is email_confirmed_at, never client metadata/provider name alone.
create function portal_private.sync_auth_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.portal_profiles(user_id,display_name,is_email_verified)
  values(new.id,left(coalesce(new.raw_user_meta_data->>'full_name',''),120),new.email_confirmed_at is not null and not coalesce(new.is_anonymous,false))
  on conflict(user_id) do update set is_email_verified=excluded.is_email_verified,updated_at=now();
  insert into portal_private.contacts(user_id) values(new.id) on conflict do nothing;
  return new;
end $$;
revoke all on function portal_private.sync_auth_profile() from public,anon,authenticated;
create trigger portal_auth_profile_sync after insert or update of email_confirmed_at,is_anonymous on auth.users
for each row execute function portal_private.sync_auth_profile();
insert into public.portal_profiles(user_id,display_name,is_email_verified)
select id,left(coalesce(raw_user_meta_data->>'full_name',''),120),email_confirmed_at is not null and not coalesce(is_anonymous,false) from auth.users;
insert into portal_private.contacts(user_id) select user_id from public.portal_profiles;
create function portal_private.profile_name_changed() returns trigger language plpgsql set search_path='' as $$
begin
  if new.display_name is distinct from old.display_name then new.is_id_verified:=false;new.id_reviewed_at:=null;end if;
  new.updated_at:=now(); return new;
end $$;
create trigger portal_profile_name_guard before update on public.portal_profiles for each row execute function portal_private.profile_name_changed();

create function portal_private.require_user(p_actor uuid) returns void language plpgsql set search_path='' as $$
begin
  if p_actor is null or not exists(select 1 from public.portal_profiles where user_id=p_actor and is_email_verified) then
    raise exception 'Verified email required' using errcode='42501';
  end if;
end $$;
create function portal_private.require_admin(p_actor uuid) returns void language plpgsql set search_path='' as $$
begin
  if p_actor is null or not exists(select 1 from portal_private.admins where user_id=p_actor) then raise exception 'Admin required' using errcode='42501';end if;
end $$;
-- Account row lock serializes activation/renewal/plan approval/cleanup decisions.
create function portal_private.guard_listing() returns trigger language plpgsql set search_path='' as $$
declare p public.portal_profiles; n integer;
begin
  if tg_op='UPDATE' and new.user_id<>old.user_id then raise exception 'Owner cannot change';end if;
  if new.is_active then
    if new.moderation_status<>'approved' then raise exception 'Listing requires moderation';end if;
    if new.expires_at<=now() then raise exception 'Listing already expired';end if;
    if tg_op='INSERT' or not old.is_active or new.expires_at is distinct from old.expires_at then
      select * into p from public.portal_profiles where user_id=new.user_id for update;
      if not p.is_email_verified then raise exception 'Verified email required';end if;
      if exists(select 1 from portal_private.cleanup_jobs where user_id=new.user_id and state='processing') then raise exception 'ID cleanup in progress; retry shortly';end if;
      select count(*) into n from public.portal_listings where user_id=new.user_id and id<>new.id and is_active and expires_at>now();
      if n>=1 and (p.multi_listing_expires_at is null or p.multi_listing_expires_at<=now()) then raise exception 'MULTI_LISTING_PACK_REQUIRED';end if;
      new.requires_multi_plan:=(n>=1);
      delete from portal_private.cleanup_jobs j where j.user_id=new.user_id and j.state='pending' and not exists(select 1 from portal_private.id_documents d where d.id=j.document_id and d.status='rejected');
    end if;
    new.inactive_since:=null; new.inactive_reason:=null;
  elsif tg_op='INSERT' then new.inactive_since:=coalesce(new.inactive_since,now());
  elsif old.is_active then new.inactive_since:=coalesce(new.inactive_since,now());
  else new.inactive_since:=old.inactive_since;
  end if;
  new.updated_at:=now(); return new;
end $$;
create trigger portal_listing_guard before insert or update on public.portal_listings for each row execute function portal_private.guard_listing();

create function public.portal_save_listing(p_actor uuid,p_listing jsonb,p_id uuid default null,p_activate boolean default true) returns uuid
language plpgsql set search_path='' as $$
declare result uuid;
begin
  perform portal_private.require_user(p_actor);
  perform 1 from public.portal_profiles where user_id=p_actor for update;
  if p_id is null then
    insert into public.portal_listings(user_id,title,description,category,commercial_type,advertiser_type,area_sqft,rent_monthly,district,locality,landmark,images,is_active)
    values(p_actor,p_listing->>'title',coalesce(p_listing->>'description',''),p_listing->>'category',nullif(p_listing->>'commercial_type',''),p_listing->>'advertiser_type',nullif(p_listing->>'area_sqft','')::integer,(p_listing->>'rent_monthly')::integer,p_listing->>'district',p_listing->>'locality',p_listing->>'landmark',array(select jsonb_array_elements_text(coalesce(p_listing->'images','[]'::jsonb))),p_activate) returning id into result;
  else
    -- Editing does not reset expiry, clear moderation or extend any paid product.
    update public.portal_listings set title=p_listing->>'title',description=coalesce(p_listing->>'description',''),category=p_listing->>'category',commercial_type=nullif(p_listing->>'commercial_type',''),advertiser_type=p_listing->>'advertiser_type',area_sqft=nullif(p_listing->>'area_sqft','')::integer,rent_monthly=(p_listing->>'rent_monthly')::integer,district=p_listing->>'district',locality=p_listing->>'locality',landmark=p_listing->>'landmark',images=array(select jsonb_array_elements_text(coalesce(p_listing->'images','[]'::jsonb))) where id=p_id and user_id=p_actor returning id into result;
    if result is null then raise exception 'Listing not found' using errcode='42501';end if;
  end if;
  return result;
end $$;
create function public.portal_remove_listing(p_actor uuid,p_listing uuid) returns void language plpgsql set search_path='' as $$
begin
  perform portal_private.require_user(p_actor);
  update public.portal_listings set is_active=false,inactive_reason='owner' where id=p_listing and user_id=p_actor;
  if not found then raise exception 'Listing not found' using errcode='42501';end if;
end $$;
create function public.portal_renew_listing(p_actor uuid,p_listing uuid) returns timestamptz language plpgsql set search_path='' as $$
declare deadline timestamptz;
begin
  perform portal_private.require_user(p_actor);
  perform 1 from public.portal_profiles where user_id=p_actor for update;
  update public.portal_listings set expires_at=now()+interval '30 days',is_active=true where id=p_listing and user_id=p_actor and moderation_status='approved' returning expires_at into deadline;
  if deadline is null then raise exception 'Listing unavailable or requires moderation' using errcode='42501';end if;
  return deadline;
end $$;
create function public.portal_issue_renewal_token(p_actor uuid,p_listing uuid) returns text language plpgsql set search_path='' as $$
declare token text; l public.portal_listings;
begin
  perform portal_private.require_user(p_actor);
  select * into l from public.portal_listings where id=p_listing and user_id=p_actor and moderation_status='approved';
  if not found then raise exception 'Listing unavailable';end if;
  token:=encode(extensions.gen_random_bytes(32),'hex');
  insert into portal_private.renewal_tokens(token_hash,listing_id,user_id,cycle,expires_at)
    values(extensions.digest(token,'sha256'),l.id,p_actor,l.expires_at,greatest(l.expires_at,now())+interval '7 days');
  return token;
end $$;
create function public.portal_redeem_renewal_token(p_token text) returns timestamptz language plpgsql set search_path='' as $$
declare t portal_private.renewal_tokens; deadline timestamptz;
begin
  if p_token is null or length(p_token)<>64 then raise exception 'Invalid token';end if;
  select * into t from portal_private.renewal_tokens where token_hash=extensions.digest(p_token,'sha256');
  if not found then raise exception 'Invalid token';end if;
  perform 1 from public.portal_profiles where user_id=t.user_id for update;
  select * into t from portal_private.renewal_tokens where token_hash=t.token_hash for update;
  if t.used_at is not null or t.expires_at<=now() or not exists(select 1 from public.portal_listings where id=t.listing_id and expires_at=t.cycle) then raise exception 'Expired or used token';end if;
  deadline:=public.portal_renew_listing(t.user_id,t.listing_id);
  update portal_private.renewal_tokens set used_at=now() where token_hash=t.token_hash;
  return deadline;
end $$;

create function public.portal_create_phone_challenge(p_actor uuid,p_phone text) returns table(challenge_id uuid,verification_text text,valid_until timestamptz)
language plpgsql set search_path='' as $$
declare nonce text;
begin
  perform portal_private.require_user(p_actor);
  if p_phone !~ '^\+91[6-9][0-9]{9}$' then raise exception 'Invalid Indian number';end if;
  perform 1 from public.portal_profiles where user_id=p_actor for update;
  if (select count(*) from portal_private.phone_challenges where user_id=p_actor and created_at>now()-interval '1 hour')>=5 then raise exception 'Try later';end if;
  update portal_private.phone_challenges set used_at=now() where user_id=p_actor and used_at is null;
  if (select phone_e164 from portal_private.contacts where user_id=p_actor) is distinct from p_phone then
    update public.portal_profiles set is_phone_verified=false where user_id=p_actor;
    update portal_private.contacts set phone_e164=p_phone,phone_verified_at=null where user_id=p_actor;
  end if;
  nonce:=encode(extensions.gen_random_bytes(32),'hex');
  return query insert into portal_private.phone_challenges(user_id,phone_e164,nonce_hash)
    values(p_actor,p_phone,extensions.digest(nonce,'sha256')) returning id,'VERIFY_'||p_actor::text||'_'||nonce,expires_at;
end $$;
create function public.portal_confirm_phone(p_admin uuid,p_actor uuid,p_nonce text,p_observed_sender text) returns void language plpgsql set search_path='' as $$
declare c portal_private.phone_challenges;
begin
  perform portal_private.require_admin(p_admin);
  perform 1 from public.portal_profiles where user_id=p_actor for update;
  select * into c from portal_private.phone_challenges where user_id=p_actor and nonce_hash=extensions.digest(p_nonce,'sha256') and used_at is null and expires_at>now() for update;
  if not found or c.phone_e164<>p_observed_sender then raise exception 'Message/number does not match a valid challenge';end if;
  update portal_private.contacts set phone_e164=c.phone_e164,phone_verified_at=now() where user_id=p_actor;
  update public.portal_profiles set is_phone_verified=true where user_id=p_actor;
  update portal_private.phone_challenges set used_at=now() where id=c.id;
  insert into portal_private.audit_log(actor_id,action,target_id) values(p_admin,'phone_confirmed_manually',p_actor);
end $$;
create function public.portal_my_id_status(p_actor uuid)
returns table(document_id uuid,status text,rejection_reason text,submitted_at timestamptz,reviewed_at timestamptz)
language plpgsql set search_path='' as $$
begin
  perform portal_private.require_user(p_actor);
  return query select d.id,d.status,d.rejection_reason,d.created_at,d.reviewed_at
    from portal_private.id_documents d where d.user_id=p_actor order by d.created_at desc limit 1;
end $$;
create function public.portal_admin_pending_ids(p_admin uuid)
returns table(document_id uuid,user_id uuid,account_name text,document_type text,object_path text,submitted_at timestamptz)
language plpgsql set search_path='' as $$
begin
  perform portal_private.require_admin(p_admin);
  return query select d.id,d.user_id,d.account_name_at_submission,d.document_type,d.id_document_url,d.created_at
    from portal_private.id_documents d where d.status='pending' and d.id_document_url is not null order by d.created_at limit 100;
end $$;
create function public.portal_register_id_upload(p_actor uuid,p_type text,p_path text,p_consent_version text) returns uuid language plpgsql set search_path='' as $$
declare result uuid; account_name text;
begin
  perform portal_private.require_user(p_actor);
  select display_name into account_name from public.portal_profiles where user_id=p_actor for update;
  if length(btrim(account_name))<2 or p_path is null or p_path not like p_actor::text||'/%' or coalesce(length(p_consent_version),0)<1 then raise exception 'Name, private object path and consent are required';end if;
  if exists(select 1 from portal_private.cleanup_jobs where user_id=p_actor and state='processing') then raise exception 'Cleanup in progress';end if;
  -- API uploads first and validates MIME/size. If this registration fails it must remove the orphan upload.
  if not exists(select 1 from storage.objects where bucket_id='portal-government-ids' and name=p_path) then raise exception 'Upload missing';end if;
  insert into portal_private.id_documents(user_id,document_type,account_name_at_submission,id_document_url,consent_version)
    values(p_actor,p_type,account_name,p_path,p_consent_version) returning id into result;
  update public.portal_profiles set is_id_verified=false,id_reviewed_at=null where user_id=p_actor;
  return result;
end $$;
create function public.portal_review_id(p_admin uuid,p_document uuid,p_approve boolean,p_reason text default null) returns void language plpgsql set search_path='' as $$
declare d portal_private.id_documents; name_now text;
begin
  perform portal_private.require_admin(p_admin);
  if p_approve is null then raise exception 'Approval decision required';end if;
  select user_id into d.user_id from portal_private.id_documents where id=p_document;
  select display_name into name_now from public.portal_profiles where user_id=d.user_id for update;
  select * into d from portal_private.id_documents where id=p_document for update;
  if d.id is null or d.status<>'pending' or d.id_document_url is null then raise exception 'Document not pending';end if;
  if p_approve and d.account_name_at_submission<>name_now then raise exception 'Account name changed; request a new document';end if;
  if not p_approve and (p_reason is null or p_reason not in ('Blurry image','Name mismatch','Incomplete ID')) then raise exception 'Select rejection reason';end if;
  update portal_private.id_documents set status=case when p_approve then 'approved' else 'rejected' end,rejection_reason=case when p_approve then null else p_reason end,reviewed_at=now(),reviewed_by=p_admin where id=d.id;
  update public.portal_profiles set is_id_verified=p_approve,id_reviewed_at=case when p_approve then now() else null end where user_id=d.user_id;
  -- Minimise retention for rejected documents; a replacement is possible after worker removal.
  if not p_approve then insert into portal_private.cleanup_jobs(document_id,user_id,object_path,due_at) values(d.id,d.user_id,d.id_document_url,now()) on conflict(object_path) do nothing;end if;
  insert into portal_private.audit_log(actor_id,action,target_id) values(p_admin,case when p_approve then 'id_approved' else 'id_rejected' end,d.id);
end $$;

create function public.portal_create_payment(p_actor uuid,p_kind text,p_listing uuid default null) returns uuid language plpgsql set search_path='' as $$
declare result uuid;
begin
  perform portal_private.require_user(p_actor);
  if p_kind='boost' and not exists(select 1 from public.portal_listings where id=p_listing and user_id=p_actor) then raise exception 'Listing not owned';end if;
  if p_kind='multi_listing' and p_listing is not null then raise exception 'Pack is account-level';end if;
  insert into public.portal_payment_requests(user_id,kind,listing_id) values(p_actor,p_kind,p_listing) returning id into result;
  return result;
end $$;
create function public.portal_submit_utr(p_actor uuid,p_payment uuid,p_utr text) returns void language plpgsql set search_path='' as $$
begin
  perform portal_private.require_user(p_actor);
  if p_utr is null or p_utr !~ '^[0-9]{12}$' then raise exception 'UTR must contain 12 digits';end if;
  update public.portal_payment_requests set claimed_utr=p_utr where id=p_payment and user_id=p_actor and status='pending';
  if not found then raise exception 'Payment unavailable';end if;
end $$;
create function public.portal_review_payment(p_admin uuid,p_payment uuid,p_approve boolean,p_observed_utr text default null,p_observed_amount_paise integer default null,p_bank_received_at timestamptz default null,p_reason text default null) returns timestamptz
language plpgsql set search_path='' as $$
declare r public.portal_payment_requests; deadline timestamptz;
begin
  perform portal_private.require_admin(p_admin);
  if p_approve is null then raise exception 'Approval decision required';end if;
  select user_id into r.user_id from public.portal_payment_requests where id=p_payment;
  perform 1 from public.portal_profiles where user_id=r.user_id for update;
  select * into r from public.portal_payment_requests where id=p_payment for update;
  if r.id is null then raise exception 'Payment not found';end if;
  if r.status='approved' then return r.entitlement_until;end if;
  if r.status<>'pending' then raise exception 'Payment not pending';end if;
  if not p_approve then
    if coalesce(length(btrim(p_reason)),0)=0 then raise exception 'Rejection reason required';end if;
    update public.portal_payment_requests set status='rejected',rejection_reason=p_reason where id=r.id;return null;
  end if;
  if p_observed_utr is null or r.claimed_utr is null or p_observed_utr<>r.claimed_utr or p_observed_amount_paise is distinct from r.amount_paise or p_bank_received_at is null or p_bank_received_at>now() or p_bank_received_at<r.created_at-interval '10 minutes' then raise exception 'Bank credit does not match';end if;
  -- Actual bank evidence only. Input UTR, client callback and screenshots alone are not approval.
  insert into portal_private.bank_receipts(utr,payment_request_id,amount_paise,bank_received_at,approved_by) values(p_observed_utr,r.id,r.amount_paise,p_bank_received_at,p_admin);
  if r.kind='multi_listing' then
    update public.portal_profiles set multi_listing_expires_at=greatest(coalesce(multi_listing_expires_at,now()),now())+interval '30 days' where user_id=r.user_id returning multi_listing_expires_at into deadline;
  else
    update public.portal_listings set boost_expires_at=greatest(coalesce(boost_expires_at,now()),now())+interval '30 days' where id=r.listing_id and user_id=r.user_id returning boost_expires_at into deadline;
    if deadline is null then raise exception 'Boost target missing';end if;
  end if;
  update public.portal_payment_requests set status='approved',approved_at=now(),entitlement_until=deadline where id=r.id;
  insert into portal_private.audit_log(actor_id,action,target_id) values(p_admin,'payment_approved',r.id);
  return deadline;
end $$;

create function public.portal_report_listing(p_actor uuid,p_listing uuid,p_reason text,p_description text default '') returns void language plpgsql set search_path='' as $$
declare owner_id uuid; n integer;
begin
  perform portal_private.require_user(p_actor);
  select user_id into owner_id from public.portal_listings where id=p_listing and moderation_status='approved' and is_active and expires_at>now() for update;
  if owner_id is null or owner_id=p_actor then raise exception 'Listing not reportable';end if;
  if (select count(*) from public.portal_reports where reporter_id=p_actor and created_at>now()-interval '1 day')>=5 then raise exception 'Report limit reached';end if;
  insert into public.portal_reports(listing_id,reporter_id,reason,description) values(p_listing,p_actor,p_reason,coalesce(p_description,'')) on conflict(listing_id,reporter_id) do nothing;
  select count(*) into n from public.portal_reports where listing_id=p_listing and status='open';
  update public.portal_listings set report_count=n,is_active=case when n>=2 then false else is_active end,moderation_status=case when n>=2 then 'quarantined' else moderation_status end,inactive_reason=case when n>=2 then 'reports' else inactive_reason end where id=p_listing;
end $$;
create function public.portal_moderate_listing(p_admin uuid,p_listing uuid,p_approve boolean) returns void language plpgsql set search_path='' as $$
declare actor uuid;
begin
  perform portal_private.require_admin(p_admin);
  if p_approve is null then raise exception 'Approval decision required';end if;
  select user_id into actor from public.portal_listings where id=p_listing;
  perform 1 from public.portal_profiles where user_id=actor for update;
  perform 1 from public.portal_listings where id=p_listing for update;
  if not found then raise exception 'Listing not found';end if;
  update public.portal_reports set status=case when p_approve then 'dismissed' else 'resolved' end where listing_id=p_listing and status='open';
  -- Approval clears quarantine; host renews explicitly (capacity/expiry checks still apply).
  update public.portal_listings set moderation_status=case when p_approve then 'approved' else 'rejected' end,report_count=0,is_active=false,inactive_reason='admin' where id=p_listing;
  insert into portal_private.audit_log(actor_id,action,target_id) values(p_admin,case when p_approve then 'listing_cleared' else 'listing_rejected' end,p_listing);
end $$;

create view public.portal_ranked_listings with (security_invoker=true) as
select l.*,p.display_name,p.is_email_verified,p.is_phone_verified,p.is_id_verified,
  coalesce(l.boost_expires_at>now(),false) as is_boosted,
  (case when l.boost_expires_at>now() then 1000 else 0 end+
   case when p.is_id_verified then 200 else 0 end+
   case when p.is_phone_verified then 100 else 0 end+
   case when p.is_email_verified then 50 else 0 end+
   greatest(0,30-extract(day from (now()-l.created_at))))::numeric as ranking_score
from public.portal_listings l join public.portal_profiles p on p.user_id=l.user_id
where l.is_active and l.moderation_status='approved' and l.expires_at>now() and
  (not l.requires_multi_plan or p.multi_listing_expires_at>now())
order by ranking_score desc,l.created_at desc,l.id;
grant select on public.portal_ranked_listings to anon,authenticated,service_role;
-- Callers also specify ORDER BY ranking_score DESC, created_at DESC, id for pagination.

-- Private bucket: browser users have NO read/list/upload permissions.
-- Upload via validated Next.js server endpoint; admin downloads via short-lived signed URLs.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('portal-government-ids','portal-government-ids',false,5242880,array['image/jpeg','image/png','image/webp']);
create policy portal_id_storage_admin_read on storage.objects for select to authenticated
  using(bucket_id='portal-government-ids' and (select portal_private.is_admin()));
-- Restrictive guards prevent pre-existing permissive Storage policies from exposing this bucket.
create policy portal_id_storage_read_guard on storage.objects as restrictive for select to anon,authenticated
  using(bucket_id<>'portal-government-ids' or (select portal_private.is_admin()));
create policy portal_id_storage_insert_guard on storage.objects as restrictive for insert to anon,authenticated
  with check(bucket_id<>'portal-government-ids');
create policy portal_id_storage_update_guard on storage.objects as restrictive for update to anon,authenticated
  using(bucket_id<>'portal-government-ids') with check(bucket_id<>'portal-government-ids');
create policy portal_id_storage_delete_guard on storage.objects as restrictive for delete to anon,authenticated
  using(bucket_id<>'portal-government-ids');

-- Grace clock is inactive_since, not mutable updated_at. An inactive edit cannot
-- perpetually delay deletion. Shared account IDs are retained while ANY listing is active.
create function public.portal_daily_maintenance() returns void language plpgsql set search_path='' as $$
declare p public.portal_profiles; keep_id uuid;
begin
  for p in select * from public.portal_profiles order by user_id for update loop
    update public.portal_listings set is_active=false,inactive_reason='expired',inactive_since=expires_at where user_id=p.user_id and is_active and expires_at<=now();
    if p.multi_listing_expires_at is null or p.multi_listing_expires_at<=now() then
      select id into keep_id from public.portal_listings where user_id=p.user_id and is_active and expires_at>now() and moderation_status='approved' order by created_at,id limit 1;
      update public.portal_listings set is_active=false,inactive_reason='plan_expired' where user_id=p.user_id and is_active and id is distinct from keep_id;
      update public.portal_listings set requires_multi_plan=false where id=keep_id;
    end if;
    insert into portal_private.cleanup_jobs(document_id,user_id,object_path,due_at)
    select d.id,d.user_id,d.id_document_url,now() from portal_private.id_documents d
    where d.user_id=p.user_id and d.id_document_url is not null and d.status not in ('deleting','deleted')
      and not exists(select 1 from public.portal_listings where user_id=p.user_id and is_active and expires_at>now())
      and greatest(d.created_at,coalesce((select max(inactive_since) from public.portal_listings where user_id=p.user_id),d.created_at))<=now()-interval '7 days'
    on conflict(object_path) do nothing;
  end loop;
  delete from portal_private.phone_challenges where expires_at<now()-interval '1 day';
  delete from portal_private.renewal_tokens where expires_at<now()-interval '1 day';
end $$;
create function portal_private.queue_deleted_profile_ids() returns trigger language plpgsql set search_path='' as $$
begin
  insert into portal_private.cleanup_jobs(document_id,user_id,object_path,due_at)
    select id,user_id,id_document_url,now() from portal_private.id_documents where user_id=old.user_id and id_document_url is not null
    on conflict(object_path) do update set due_at=now();
  return old;
end $$;
create trigger portal_profile_deletion_cleanup before delete on public.portal_profiles for each row execute function portal_private.queue_deleted_profile_ids();
create function public.portal_claim_id_cleanup(p_limit integer default 20) returns setof portal_private.cleanup_jobs language plpgsql set search_path='' as $$
declare j portal_private.cleanup_jobs; locked_owner uuid;
begin
  for j in select * from portal_private.cleanup_jobs where due_at<=now() and (state='pending' or (state='processing' and leased_until<now())) order by due_at,id limit least(greatest(p_limit,1),100) loop
    perform 1 from public.portal_profiles where user_id=j.user_id for update;
    select id into locked_owner from portal_private.cleanup_jobs where id=j.id and (state='pending' or (state='processing' and leased_until<now())) for update skip locked;
    if not found then continue;end if;
    if j.state='pending' and exists(select 1 from public.portal_listings where user_id=j.user_id and is_active and expires_at>now()) and not exists(select 1 from portal_private.id_documents where id=j.document_id and status='rejected') then
      delete from portal_private.cleanup_jobs where id=j.id;continue;
    end if;
    update portal_private.id_documents set status='deleting' where id=j.document_id;
    return query update portal_private.cleanup_jobs set state='processing',claim_token=gen_random_uuid(),leased_until=now()+interval '5 minutes',attempts=attempts+1 where id=j.id returning *;
  end loop;
end $$;
create function public.portal_finish_id_cleanup(p_job uuid,p_claim uuid,p_success boolean) returns void language plpgsql set search_path='' as $$
declare j portal_private.cleanup_jobs;
begin
  select * into j from portal_private.cleanup_jobs where id=p_job and state='processing' and claim_token=p_claim for update;
  if not found then raise exception 'Cleanup lease lost';end if;
  if p_success then
    -- Only after Storage API confirms removal (including an already-absent object).
    update portal_private.id_documents set id_document_url=null,status='deleted' where id=j.document_id and id_document_url=j.object_path;
    update portal_private.cleanup_jobs set state='complete',completed_at=now(),object_path='deleted/'||id::text,last_error=null where id=j.id;
  else
    -- Keep processing to block renewal until an uncertain deletion is safely retried.
    update portal_private.cleanup_jobs set leased_until=now(),last_error='Storage removal failed; retry required' where id=j.id;
  end if;
end $$;

-- SECURITY: every mutation above is server-only, including admin checks accepting actor UUIDs.
-- Browser must never receive service_role. Admin membership is provisioned via SQL only.
do $$ declare r record; begin
  for r in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'portal_%' loop
    execute format('revoke all on function %s from public,anon,authenticated',r.signature);
    execute format('grant execute on function %s to service_role',r.signature);
  end loop;
  for r in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='portal_private' and p.proname<>'is_admin' loop
    execute format('revoke all on function %s from public,anon,authenticated',r.signature);
    execute format('grant execute on function %s to service_role',r.signature);
  end loop;
end $$;
commit;

-- BEGIN HOSTED INTEGRATIONS (Supabase Postgres, not portable embedded Postgres)
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
-- Supabase Vault is preinstalled. Create portal_cleanup_url and portal_cleanup_secret
-- through Dashboard Vault. URL points to the deployed ID cleanup Edge Function.
create function portal_private.dispatch_cleanup_worker() returns bigint language plpgsql security definer set search_path='' as $$
declare endpoint text; secret text; request_id bigint;
begin
  select decrypted_secret into endpoint from vault.decrypted_secrets where name='portal_cleanup_url' limit 1;
  select decrypted_secret into secret from vault.decrypted_secrets where name='portal_cleanup_secret' limit 1;
  if endpoint is null or secret is null then raise notice 'ID cleanup worker not configured; durable jobs remain queued';return null;end if;
  if endpoint !~ '^https://' then raise exception 'Cleanup URL must use HTTPS';end if;
  select net.http_post(url:=endpoint,headers:=jsonb_build_object('Content-Type','application/json','x-cron-secret',secret),body:='{}'::jsonb,timeout_milliseconds:=10000) into request_id;
  return request_id;
end $$;
revoke all on function portal_private.dispatch_cleanup_worker() from public,anon,authenticated;
grant execute on function portal_private.dispatch_cleanup_worker() to service_role;
-- 01:00 UTC = 06:30 India. Daily expiry enqueues ID deletions; worker retries hourly.
select cron.schedule('portal-daily-maintenance','0 1 * * *','select public.portal_daily_maintenance(); select portal_private.dispatch_cleanup_worker();');
select cron.schedule('portal-id-cleanup-retry','5 * * * *','select portal_private.dispatch_cleanup_worker();');
-- END HOSTED INTEGRATIONS
