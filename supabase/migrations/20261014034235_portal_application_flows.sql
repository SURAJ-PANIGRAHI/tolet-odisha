-- Staging-first application flow. Requires portal v2 and Evolution migrations.
begin;
alter table public.portal_listings add column contact_name text not null default '' check(length(contact_name)<=200), add column contact_phone text check(contact_phone ~ '^[6-9][0-9]{9}$'), add column whatsapp_number text, add column deposit integer not null default 0 check(deposit between 0 and 10000000), add column amenities text[] not null default '{}';
alter table portal_private.id_documents drop constraint id_documents_document_type_check;
alter table portal_private.id_documents add constraint id_documents_document_type_check check(document_type in ('passport','masked_aadhaar','driving_licence','voter_id'));

alter table portal_private.contacts add column email text, add column last_listing_left_at timestamptz;
create or replace function portal_private.sync_auth_profile() returns trigger language plpgsql security definer set search_path='' as $$begin
 insert into public.portal_profiles(user_id,display_name,is_email_verified) values(new.id,left(coalesce(new.raw_user_meta_data->>'full_name',''),120),new.email_confirmed_at is not null and not coalesce(new.is_anonymous,false)) on conflict(user_id) do update set is_email_verified=excluded.is_email_verified,updated_at=now();
 insert into portal_private.contacts(user_id,email) values(new.id,new.email) on conflict(user_id) do update set email=excluded.email;
 return new;
end $$;
drop trigger portal_auth_profile_sync on auth.users;
create trigger portal_auth_profile_sync after insert or update of email,email_confirmed_at,is_anonymous on auth.users for each row execute function portal_private.sync_auth_profile();
update portal_private.contacts c set email=u.email from auth.users u where u.id=c.user_id;

create table portal_private.management_keys(listing_id uuid primary key references public.portal_listings(id) on delete cascade,key_hash bytea not null unique,created_at timestamptz not null default now());
alter table portal_private.management_keys enable row level security;
revoke all on portal_private.management_keys from public,anon,authenticated;
grant all on portal_private.management_keys to service_role;
create or replace function portal_private.require_user(p_actor uuid) returns void language plpgsql set search_path='' as $$begin
 if p_actor is null or not exists(select 1 from public.portal_profiles p where p.user_id=p_actor) then raise exception 'Account session required' using errcode='42501';end if;
end $$;
create or replace function portal_private.guard_listing() returns trigger language plpgsql set search_path='' as $$
declare p public.portal_profiles; n integer;
begin
  if tg_op='UPDATE' and new.user_id<>old.user_id and (current_user not in ('service_role','postgres') or coalesce(current_setting('portal.claim_listing',true),'')<>new.id::text) then raise exception 'Owner cannot change';end if;
  if new.is_active then
    if new.moderation_status<>'approved' then raise exception 'Listing requires moderation';end if;
    if new.expires_at<=now() then raise exception 'Listing already expired';end if;
    if tg_op='INSERT' or not old.is_active or new.expires_at is distinct from old.expires_at or new.user_id is distinct from old.user_id then
      select * into p from public.portal_profiles where user_id=new.user_id for update;
      if p.user_id is null then raise exception 'Account session required';end if;
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

create function public.portal_post_listing(p_actor uuid,p_listing jsonb,p_hash text) returns uuid language plpgsql set search_path='' as $$declare result uuid;begin
 perform portal_private.require_user(p_actor);
 if p_hash is null or p_hash !~ '^[0-9a-f]{64}$' then raise exception 'Invalid management key';end if;
 update public.portal_profiles set display_name=left(p_listing->>'contact_name',120) where user_id=p_actor and display_name='';
 result:=public.portal_save_listing(p_actor,p_listing);
 update public.portal_listings set contact_name=p_listing->>'contact_name',contact_phone=p_listing->>'contact_phone',whatsapp_number=p_listing->>'contact_phone',deposit=coalesce((p_listing->>'deposit')::integer,0),amenities=array(select jsonb_array_elements_text(coalesce(p_listing->'amenities','[]'))) where id=result;
 insert into portal_private.management_keys(listing_id,key_hash) values(result,decode(p_hash,'hex'));
 return result;
end $$;
create function public.portal_edit_listing(p_actor uuid,p_listing uuid,p_data jsonb) returns void language plpgsql set search_path='' as $$begin
 perform public.portal_save_listing(p_actor,p_data,p_listing);
 update public.portal_listings set contact_name=p_data->>'contact_name',contact_phone=p_data->>'contact_phone',whatsapp_number=p_data->>'contact_phone',deposit=coalesce((p_data->>'deposit')::integer,0),amenities=array(select jsonb_array_elements_text(coalesce(p_data->'amenities','[]'))) where id=p_listing and user_id=p_actor;
end $$;
create function public.portal_management_actor(p_listing uuid,p_hash text) returns uuid language sql set search_path='' as $$
 select l.user_id from public.portal_listings l join portal_private.management_keys k on k.listing_id=l.id where l.id=p_listing and encode(k.key_hash,'hex')=p_hash;
$$;
create function public.portal_claim_listing(p_actor uuid,p_listing uuid,p_hash text) returns void language plpgsql set search_path='' as $$declare old_actor uuid;begin
 perform portal_private.require_user(p_actor);
 if not exists(select 1 from public.portal_profiles where user_id=p_actor and is_email_verified) then raise exception 'Sign in with email or Google first';end if;
 old_actor:=public.portal_management_actor(p_listing,p_hash);
 if old_actor is null then raise exception 'Invalid management link' using errcode='42501';end if;
 -- Lock both account rows in stable order, then key/listing; do not merge profiles or verification.
 perform 1 from public.portal_profiles where user_id in (p_actor,old_actor) order by user_id for update;
 perform 1 from portal_private.management_keys where listing_id=p_listing and encode(key_hash,'hex')=p_hash for update;
 if not found then raise exception 'Invalid management link' using errcode='42501';end if;
 perform set_config('portal.claim_listing',p_listing::text,true);
 update public.portal_listings set user_id=p_actor where id=p_listing;
 if old_actor<>p_actor then
 update portal_private.contacts set last_listing_left_at=now() where user_id=old_actor;
 delete from portal_private.cleanup_jobs j where j.user_id=old_actor and j.state='pending' and j.document_id is not null and not exists(select 1 from portal_private.id_documents d where d.id=j.document_id and d.status='rejected');
 end if;
 perform set_config('portal.claim_listing','',true);
 delete from portal_private.management_keys where listing_id=p_listing;
 insert into portal_private.audit_log(actor_id,action,target_id) values(p_actor,'guest_listing_claimed',p_listing);
end $$;
create function public.portal_account_admin(p_actor uuid) returns boolean language sql set search_path='' as $$select exists(select 1 from portal_private.admins where user_id=p_actor);$$;
create function public.portal_public_feed() returns jsonb language sql set search_path='' as $$
 select coalesce(jsonb_agg(row_data order by ranking_score desc,created_at desc,id),'[]') from (
 select l.id,l.created_at,(case when l.boost_expires_at>now() then 1000 else 0 end+case when p.is_id_verified then 200 else 0 end+case when p.is_phone_verified and ct.phone_e164='+91'||l.contact_phone then 100 else 0 end+case when p.is_email_verified then 50 else 0 end+greatest(0,30-extract(day from now()-l.created_at))) ranking_score,
 to_jsonb(l)||jsonb_build_object('portal_listing',true,'email_verified',p.is_email_verified,'phone_verified',p.is_phone_verified and ct.phone_e164='+91'||l.contact_phone,'id_verified',p.is_id_verified,'is_featured',coalesce(l.boost_expires_at>now(),false),'ranking_score',(case when l.boost_expires_at>now() then 1000 else 0 end+case when p.is_id_verified then 200 else 0 end+case when p.is_phone_verified and ct.phone_e164='+91'||l.contact_phone then 100 else 0 end+case when p.is_email_verified then 50 else 0 end+greatest(0,30-extract(day from now()-l.created_at)))) as row_data
 from public.portal_listings l join public.portal_profiles p on p.user_id=l.user_id join portal_private.contacts ct on ct.user_id=p.user_id
 where l.is_active and l.expires_at>now() and l.moderation_status='approved' and (not l.requires_multi_plan or p.multi_listing_expires_at>now())
 order by l.created_at desc,l.id limit 1000) q;
$$;
-- Public RLS/grants are unchanged. The feed RPC is server-only and returns only listing/public badge data.
create table portal_private.email_jobs(id uuid primary key default gen_random_uuid(),dedupe_key text not null unique,kind text not null check(kind in ('reminder','report')),recipient text not null,listing_id uuid references public.portal_listings(id) on delete cascade,cycle timestamptz,payload jsonb not null,state text not null default 'pending' check(state in ('pending','processing','sent','failed')),claim_token uuid,leased_until timestamptz,attempts integer not null default 0,next_attempt_at timestamptz not null default now(),created_at timestamptz not null default now());
alter table portal_private.email_jobs enable row level security;
revoke all on portal_private.email_jobs from public,anon,authenticated;
grant all on portal_private.email_jobs to service_role;
create index portal_email_due on portal_private.email_jobs(next_attempt_at) where state in ('pending','processing');
alter function public.portal_daily_maintenance() rename to portal_daily_maintenance_base;
create function public.portal_daily_maintenance() returns void language plpgsql set search_path='' as $$declare l record;token text;begin
 perform public.portal_daily_maintenance_base();
 delete from portal_private.cleanup_jobs j using portal_private.contacts c where c.user_id=j.user_id and c.last_listing_left_at>now()-interval '7 days' and j.state='pending' and j.document_id is not null and not exists(select 1 from portal_private.id_documents d where d.id=j.document_id and d.status='rejected');
 delete from portal_private.email_jobs where state in ('sent','failed') and created_at<now()-interval '30 days';
 for l in select x.id,x.title,x.expires_at,c.email from public.portal_listings x join public.portal_profiles p on p.user_id=x.user_id join portal_private.contacts c on c.user_id=p.user_id where x.is_active and x.moderation_status='approved' and x.expires_at>now() and x.expires_at<=now()+interval '3 days' and p.is_email_verified and c.email is not null and not exists(select 1 from portal_private.email_jobs j where j.dedupe_key='reminder:'||x.id||':'||x.expires_at::text) for update of x loop
 token:=public.portal_issue_renewal_token((select user_id from public.portal_listings where id=l.id),l.id);
 insert into portal_private.email_jobs(dedupe_key,kind,recipient,listing_id,cycle,payload) values('reminder:'||l.id||':'||l.expires_at::text,'reminder',l.email,l.id,l.expires_at,jsonb_build_object('title',l.title,'token',token)) on conflict(dedupe_key) do nothing;
 end loop;
end $$;
alter function public.portal_report_listing(uuid,uuid,text,text) rename to portal_report_listing_base;
create function public.portal_report_listing(p_actor uuid,p_listing uuid,p_reason text,p_description text default '') returns void language plpgsql set search_path='' as $$declare r public.portal_reports;dest text;begin
 perform public.portal_report_listing_base(p_actor,p_listing,p_reason,p_description);
 select * into r from public.portal_reports where listing_id=p_listing and reporter_id=p_actor;
 foreach dest in array array['support@toletodisha.in','surajpanigrahi.95@gmail.com'] loop
 insert into portal_private.email_jobs(dedupe_key,kind,recipient,listing_id,payload) values('report:'||r.id||':'||dest,'report',dest,p_listing,jsonb_build_object('title',(select title from public.portal_listings where id=p_listing),'reason',r.reason,'description',r.description)) on conflict(dedupe_key) do nothing;
 end loop;
end $$;
create function public.portal_claim_emails(p_limit integer default 5) returns setof portal_private.email_jobs language plpgsql set search_path='' as $$begin
 -- Drop stale reminders; never send to an address that is no longer verified/current.
 delete from portal_private.email_jobs j where j.kind='reminder' and j.state<>'sent' and not exists(select 1 from public.portal_listings l join public.portal_profiles p on p.user_id=l.user_id join portal_private.contacts c on c.user_id=p.user_id where l.id=j.listing_id and l.is_active and l.expires_at=j.cycle and l.expires_at>now() and p.is_email_verified and c.email=j.recipient);
 return query with candidates as (select id from portal_private.email_jobs where next_attempt_at<=now() and (state='pending' or (state='processing' and leased_until<now())) order by next_attempt_at limit least(greatest(p_limit,1),20) for update skip locked)
 update portal_private.email_jobs j set state='processing',claim_token=gen_random_uuid(),leased_until=now()+interval '3 minutes',attempts=attempts+1 from candidates c where j.id=c.id returning j.*;
end $$;
create function public.portal_finish_email(p_job uuid,p_claim uuid,p_sent boolean,p_permanent boolean default false) returns void language plpgsql set search_path='' as $$begin
 update portal_private.email_jobs set state=case when p_sent then 'sent' when p_permanent then 'failed' else 'pending' end,leased_until=null,next_attempt_at=now()+least(interval '6 hours',interval '1 minute'*power(2,least(attempts,9))) where id=p_job and claim_token=p_claim and state='processing';
end $$;
create or replace function public.portal_accept_whatsapp_verification(p_actor uuid,p_nonce text,p_sender text,p_instance text,p_message_id text,p_sent_at timestamptz default null) returns text
language plpgsql set search_path='' as $$
declare c portal_private.phone_challenges;
begin
  if p_actor is null or p_nonce is null or p_nonce !~ '^[0-9a-f]{64}$' or p_sender is null or p_sender !~ '^\+91[6-9][0-9]{9}$' or coalesce(length(p_instance),0) not between 1 and 120 or coalesce(length(p_message_id),0) not between 1 and 200 then return 'ignored';end if;
  perform 1 from public.portal_profiles where user_id=p_actor for update;
  if not found then return 'ignored';end if;
  if exists(select 1 from portal_private.whatsapp_receipts where instance=p_instance and message_id=p_message_id) then return 'duplicate';end if;
  select * into c from portal_private.phone_challenges
    where user_id=p_actor and nonce_hash=extensions.digest(p_nonce,'sha256') for update;
  if not found or c.used_at is not null or c.expires_at<=now() then return 'ignored';end if;
  if c.phone_e164<>p_sender or p_sent_at>now()+interval '5 minutes' or p_sent_at<c.created_at-interval '2 minutes' then return 'ignored';end if;
  if (select phone_e164 from portal_private.contacts where user_id=p_actor) is distinct from c.phone_e164 then return 'ignored';end if;
  -- Another account cannot steal a verified number, even with a valid fresh challenge.
  if exists(select 1 from portal_private.contacts where user_id<>p_actor and phone_e164=p_sender and phone_verified_at is not null) then return 'number_in_use';end if;
  insert into portal_private.whatsapp_receipts(instance,message_id,user_id) values(p_instance,p_message_id,p_actor) on conflict do nothing;
  if not found then return 'duplicate';end if;
  begin
    update portal_private.contacts set phone_e164=p_sender,phone_verified_at=now() where user_id=p_actor;
  exception when unique_violation then
    delete from portal_private.whatsapp_receipts where instance=p_instance and message_id=p_message_id;
    return 'number_in_use';
  end;
  update public.portal_profiles set is_phone_verified=true where user_id=p_actor;
  update portal_private.phone_challenges set used_at=now() where id=c.id;
  insert into portal_private.audit_log(actor_id,action,target_id) values(p_actor,'phone_confirmed_whatsapp_webhook',c.id);
  return 'verified';
end $$;


create or replace function public.portal_claim_id_cleanup(p_limit integer default 20) returns setof portal_private.cleanup_jobs language plpgsql set search_path='' as $$
declare j portal_private.cleanup_jobs; locked_owner uuid;
begin
  for j in select * from portal_private.cleanup_jobs where due_at<=now() and (state='pending' or (state='processing' and leased_until<now())) order by due_at,id limit least(greatest(p_limit,1),100) loop
    perform 1 from public.portal_profiles where user_id=j.user_id for update;
    select id into locked_owner from portal_private.cleanup_jobs where id=j.id and (state='pending' or (state='processing' and leased_until<now())) for update skip locked;
    if not found then continue;end if;
    if j.state='pending' and j.document_id is not null and exists(select 1 from public.portal_listings where user_id=j.user_id and is_active and expires_at>now()) and not exists(select 1 from portal_private.id_documents where id=j.document_id and status='rejected') then
      delete from portal_private.cleanup_jobs where id=j.id;continue;
    end if;
    update portal_private.id_documents set status='deleting' where id=j.document_id;
    return query update portal_private.cleanup_jobs set state='processing',claim_token=gen_random_uuid(),leased_until=now()+interval '5 minutes',attempts=attempts+1 where id=j.id returning *;
  end loop;
end $$;


-- Upload tickets ensure failed or uncertain registrations cannot leave retained orphan IDs.
create function public.portal_prepare_id_upload(p_actor uuid,p_path text) returns void language plpgsql set search_path='' as $$begin
 perform portal_private.require_user(p_actor);
 if p_path is null or p_path not like p_actor::text||'/%' or length(p_path)>500 then raise exception 'Invalid private upload path';end if;
 perform 1 from public.portal_profiles where user_id=p_actor for update;
 if (select count(*) from portal_private.cleanup_jobs where user_id=p_actor and document_id is null and state<>'complete')>=3 then raise exception 'Upload recovery pending; retry later';end if;
 insert into portal_private.cleanup_jobs(user_id,object_path,due_at) values(p_actor,p_path,now()+interval '1 day');
end $$;
alter function public.portal_register_id_upload(uuid,text,text,text) rename to portal_register_id_upload_base;
create function public.portal_register_id_upload(p_actor uuid,p_type text,p_path text,p_consent_version text) returns uuid language plpgsql set search_path='' as $$declare result uuid;begin
 result:=public.portal_register_id_upload_base(p_actor,p_type,p_path,p_consent_version);
 delete from portal_private.cleanup_jobs where object_path=p_path and document_id is null and state='pending';
 return result;
end $$;
-- Carry across existing staff membership without using user-editable metadata.
do $$begin if to_regclass('public.admin_users') is not null then execute 'insert into portal_private.admins(user_id) select user_id from public.admin_users on conflict do nothing';end if;end $$;


-- Name changes revoke an ID attestation and allow resubmission after deletion.
revoke update on public.portal_profiles from authenticated;
revoke update(display_name) on public.portal_profiles from authenticated;
create or replace function portal_private.profile_name_changed() returns trigger language plpgsql set search_path='' as $$begin
 if new.display_name is distinct from old.display_name then
 new.is_id_verified:=false;new.id_reviewed_at:=null;
 insert into portal_private.cleanup_jobs(document_id,user_id,object_path,due_at)
 select id,user_id,id_document_url,now() from portal_private.id_documents where user_id=new.user_id and id_document_url is not null and status in ('pending','approved') on conflict(object_path) do nothing;
 update portal_private.id_documents set status='rejected',rejection_reason='Name mismatch' where user_id=new.user_id and id_document_url is not null and status in ('pending','approved');
 end if;
 new.updated_at:=now();return new;
end $$;

-- Only these new helpers are exposed to the server. Original service-only grants persist after replacements.
do $$declare r record;begin
 for r in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'portal_%' loop
 execute format('revoke all on function %s from public,anon,authenticated',r.signature);execute format('grant execute on function %s to service_role',r.signature);end loop;
end $$;
commit;
