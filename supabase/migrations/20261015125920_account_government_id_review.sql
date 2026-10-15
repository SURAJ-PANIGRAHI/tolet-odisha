begin;
grant select on public.admin_users to service_role;
grant select,update on public.reports to service_role;
create table account_verification_private.government_ids (
 id uuid primary key default gen_random_uuid(),user_id uuid references auth.users(id) on delete set null,
 account_name text not null check(length(account_name) between 2 and 120),
 document_type text not null check(document_type in ('passport','masked_aadhaar','driving_licence','voter_id')),
 object_path text unique,status text not null default 'uploading' check(status in ('uploading','pending','approved','rejected','deleting','deleted')),
 rejection_reason text check(rejection_reason in ('Blurry image','Name mismatch','Incomplete ID','Unsupported document')),
 consent_version text not null default 'account-id-v1',created_at timestamptz not null default now(),submitted_at timestamptz,
 reviewed_at timestamptz,reviewed_by uuid references auth.users(id) on delete set null,
 inactive_since timestamptz,delete_after timestamptz,cleanup_reason text,claim_token uuid,lease_until timestamptz,
 constraint account_id_path check(object_path is null or ((user_id is null or object_path like user_id::text||'/%') and length(object_path)<200))
);
create unique index account_one_id_file on account_verification_private.government_ids(user_id) where object_path is not null;
create index account_id_queue on account_verification_private.government_ids(status,submitted_at);
create index account_id_retention on account_verification_private.government_ids(delete_after) where object_path is not null;
alter table account_verification_private.government_ids enable row level security;
revoke all on account_verification_private.government_ids from public,anon,authenticated;
grant all on account_verification_private.government_ids to service_role;
create table account_verification_private.id_review_audit (
 id bigint generated always as identity primary key,document_id uuid references account_verification_private.government_ids(id) on delete set null,
 actor_id uuid references auth.users(id) on delete set null,action text not null,created_at timestamptz not null default now()
);
alter table account_verification_private.id_review_audit enable row level security;
revoke all on account_verification_private.id_review_audit from public,anon,authenticated;
grant all on account_verification_private.id_review_audit to service_role;
grant usage on sequence account_verification_private.id_review_audit_id_seq to service_role;
alter table public.listings add column id_verified boolean not null default false;
alter table public.reports add column resolved_at timestamptz,add column reviewed_by uuid references auth.users(id) on delete set null;

create function account_verification_private.require_admin(p_actor uuid) returns void language plpgsql set search_path='' as $$
begin
 perform account_verification_private.require_account(p_actor);
 if not exists(select 1 from public.admin_users where user_id=p_actor) then raise exception 'Administrator access required' using errcode='42501';end if;
end $$;

create function account_verification_private.has_active_listing(p_actor uuid) returns boolean language sql stable set search_path='' as $$
 select exists(select 1 from public.listings l join public.listing_management_keys k on k.listing_id=l.id where k.verified_user=p_actor and k.removed_at is null and l.is_active and l.expires_at>now() and l.moderation_status='approved');
$$;

create function account_verification_private.refresh_id_retention(p_actor uuid) returns void language plpgsql set search_path='' as $$
begin
 if p_actor is null then return;end if;
 perform account_verification_private.require_account(p_actor);
 if account_verification_private.has_active_listing(p_actor) then
  if exists(select 1 from account_verification_private.government_ids where user_id=p_actor and status='deleting' and object_path is not null) then raise exception 'ID cleanup in progress. Please retry shortly.';end if;
  update account_verification_private.government_ids set inactive_since=null,delete_after=null where user_id=p_actor and status in ('pending','approved');
 else
  update account_verification_private.government_ids set inactive_since=coalesce(inactive_since,now()),delete_after=coalesce(inactive_since,now())+interval '7 days' where user_id=p_actor and status in ('pending','approved');
 end if;
end $$;

create or replace function account_verification_private.sync_listing(p_listing uuid) returns void
language plpgsql set search_path='' as $$
declare actor uuid;
begin
 select verified_user into actor from public.listing_management_keys where listing_id=p_listing;
 if actor is not null then perform account_verification_private.refresh_id_retention(actor);end if;
 update public.listings l set phone_verified_at=(select p.verified_at from account_verification_private.phones p where p.user_id=actor and p.phone_e164=account_verification_private.normal_phone(l.contact_phone)),
 id_verified=exists(select 1 from account_verification_private.government_ids d where d.user_id=actor and d.status='approved' and d.object_path is not null) where l.id=p_listing;
end $$;

create function account_verification_private.id_listing_activity() returns trigger language plpgsql set search_path='' as $$
declare actor uuid;
begin
 select verified_user into actor from public.listing_management_keys where listing_id=coalesce(new.id,old.id);
 if actor is not null then perform account_verification_private.refresh_id_retention(actor);end if;
 return null;
end $$;
create trigger account_id_listing_activity after update of is_active,expires_at,moderation_status or delete on public.listings for each row execute function account_verification_private.id_listing_activity();

create function public.account_prepare_id_upload(p_actor uuid,p_type text,p_name text,p_extension text) returns table(document_id uuid,object_path text)
language plpgsql set search_path='' as $$
declare doc uuid:=gen_random_uuid();path text;
begin
 perform account_verification_private.require_account(p_actor);
 if p_type not in ('passport','masked_aadhaar','driving_licence','voter_id') or p_type is null or p_extension not in ('jpg','png','webp') or p_extension is null or coalesce(length(btrim(p_name)),0) not between 2 and 120 then raise exception 'Invalid ID details';end if;
 if exists(select 1 from account_verification_private.government_ids g where g.user_id=p_actor and g.object_path is not null) then raise exception 'An ID is already on file';end if;
 if (select count(*) from account_verification_private.government_ids where user_id=p_actor and created_at>now()-interval '1 day')>=5 then raise exception 'Daily upload limit reached';end if;
 path:=p_actor::text||'/'||doc::text||'.'||p_extension;
 insert into account_verification_private.government_ids(id,user_id,document_type,account_name,object_path) values(doc,p_actor,p_type,btrim(p_name),path);
 return query select doc,path;
end $$;

create function public.account_finish_id_upload(p_actor uuid,p_document uuid) returns boolean language plpgsql set search_path='' as $$
begin
 perform account_verification_private.require_account(p_actor);
 update account_verification_private.government_ids set status='pending',submitted_at=now() where id=p_document and user_id=p_actor and status='uploading' and created_at>now()-interval '1 hour';
 if not found then return false;end if;
 perform account_verification_private.refresh_id_retention(p_actor);
 return true;
end $$;

create function public.account_my_id_status(p_actor uuid) returns table(id uuid,account_name text,document_type text,status text,rejection_reason text,submitted_at timestamptz,reviewed_at timestamptz,delete_after timestamptz,has_file boolean,is_admin boolean)
language plpgsql set search_path='' as $$
begin
 perform account_verification_private.require_account(p_actor);
 return query select d.id,d.account_name,d.document_type,coalesce(d.status,'none'),d.rejection_reason,d.submitted_at,d.reviewed_at,d.delete_after,d.object_path is not null,exists(select 1 from public.admin_users a where a.user_id=p_actor)
 from (select p_actor as actor) x left join lateral(select * from account_verification_private.government_ids where user_id=x.actor order by created_at desc limit 1) d on true;
end $$;

create function public.account_admin_id_queue(p_admin uuid) returns jsonb language plpgsql set search_path='' as $$
declare docs jsonb;stats jsonb;
begin
 perform account_verification_private.require_admin(p_admin);
 select coalesce(jsonb_agg(to_jsonb(q)),'[]') into docs from (select id,user_id,account_name,document_type,status,rejection_reason,submitted_at,reviewed_at,delete_after,object_path is not null as has_file from account_verification_private.government_ids where status<>'uploading' order by (status='pending') desc,submitted_at asc limit 200) q;
 select jsonb_build_object('pending',count(*) filter(where status='pending'),'overdue',count(*) filter(where status='pending' and submitted_at<now()-interval '48 hours'),'approved',count(*) filter(where status='approved'),'rejected',count(*) filter(where status='rejected')) into stats from account_verification_private.government_ids;
 return jsonb_build_object('documents',docs,'stats',stats);
end $$;

create function public.account_admin_id_file(p_admin uuid,p_document uuid) returns text language plpgsql set search_path='' as $$
declare path text;
begin
 perform account_verification_private.require_admin(p_admin);
 select object_path into path from account_verification_private.government_ids where id=p_document and status in ('pending','approved','rejected');
 if path is not null then insert into account_verification_private.id_review_audit(document_id,actor_id,action) values(p_document,p_admin,'document_viewed');end if;
 return path;
end $$;

create function public.account_review_id(p_admin uuid,p_document uuid,p_approve boolean,p_reason text default null) returns boolean language plpgsql set search_path='' as $$
declare d account_verification_private.government_ids;
begin
 perform account_verification_private.require_admin(p_admin);
 select * into d from account_verification_private.government_ids where id=p_document;
 if not found then return false;end if;
 if d.user_id is not null then perform account_verification_private.require_account(d.user_id);end if;
 select * into d from account_verification_private.government_ids where id=p_document for update;
 if d.status<>'pending' or d.object_path is null or p_approve is null then return false;end if;
 if not p_approve and (p_reason is null or p_reason not in ('Blurry image','Name mismatch','Incomplete ID','Unsupported document')) then raise exception 'Choose a rejection reason';end if;
 update account_verification_private.government_ids set status=case when p_approve then 'approved' else 'rejected' end,rejection_reason=case when p_approve then null else p_reason end,reviewed_at=now(),reviewed_by=p_admin,delete_after=case when p_approve then delete_after else now() end,cleanup_reason=case when p_approve then null else 'rejected' end where id=p_document;
 update public.listings l set id_verified=p_approve from public.listing_management_keys k where k.listing_id=l.id and k.verified_user=d.user_id;
 insert into account_verification_private.id_review_audit(document_id,actor_id,action) values(p_document,p_admin,case when p_approve then 'approved' else 'rejected' end);
 return true;
end $$;

create function public.account_withdraw_id(p_actor uuid) returns boolean language plpgsql set search_path='' as $$
begin
 perform account_verification_private.require_account(p_actor);
 update account_verification_private.government_ids set status='deleting',cleanup_reason='withdrawn',delete_after=now() where user_id=p_actor and object_path is not null and status<>'deleting';
 update public.listings l set id_verified=false from public.listing_management_keys k where k.listing_id=l.id and k.verified_user=p_actor;
 return true;
end $$;

create function public.account_claim_id_cleanup(p_limit integer default 5) returns table(document_id uuid,object_path text,claim uuid) language plpgsql set search_path='' as $$
declare d account_verification_private.government_ids;c uuid;
begin
 -- Daily reconciliation covers expired listings even if their public flag has not yet changed.
 for d in select g.* from account_verification_private.government_ids g where g.object_path is not null and g.status in ('pending','approved') loop
  perform account_verification_private.refresh_id_retention(d.user_id);
 end loop;
 for d in select g.* from account_verification_private.government_ids g where g.object_path is not null and ((g.status='uploading' and g.created_at<now()-interval '1 hour') or g.delete_after<=now() or g.user_id is null) and (g.lease_until is null or g.lease_until<now()) order by g.created_at limit greatest(1,least(p_limit,20)) loop
  if d.user_id is not null then perform account_verification_private.require_account(d.user_id);end if;
  select * into d from account_verification_private.government_ids g where g.id=d.id for update;
  if d.object_path is null or (d.lease_until is not null and d.lease_until>=now()) then continue;end if;
  if not ((d.status='uploading' and d.created_at<now()-interval '1 hour') or d.delete_after<=now() or d.user_id is null) then continue;end if;
  if d.user_id is not null and d.status in ('approved','pending') and account_verification_private.has_active_listing(d.user_id) then continue;end if;
  c:=gen_random_uuid();
  update account_verification_private.government_ids set status='deleting',claim_token=c,lease_until=now()+interval '5 minutes' where id=d.id;
  update public.listings l set id_verified=false from public.listing_management_keys k where k.listing_id=l.id and k.verified_user=d.user_id;
  return query select d.id,d.object_path,c;
 end loop;
end $$;

create function public.account_finish_id_cleanup(p_document uuid,p_claim uuid,p_success boolean) returns boolean language plpgsql set search_path='' as $$
declare d account_verification_private.government_ids;
begin
 select * into d from account_verification_private.government_ids where id=p_document;
 if not found then return false;end if;
 if d.user_id is not null then perform account_verification_private.require_account(d.user_id);end if;
 select * into d from account_verification_private.government_ids where id=p_document for update;
 if d.status<>'deleting' or d.claim_token is distinct from p_claim then return false;end if;
 if p_success then
  update account_verification_private.government_ids set object_path=null,status=case when cleanup_reason='rejected' then 'rejected' else 'deleted' end,claim_token=null,lease_until=null where id=d.id;
  insert into account_verification_private.id_review_audit(document_id,action) values(d.id,'file_deleted');
 else
  update account_verification_private.government_ids set claim_token=null,lease_until=now()+interval '1 hour' where id=d.id;
 end if;
 return true;
end $$;

create function public.account_admin_moderate_listing(p_admin uuid,p_listing uuid,p_approve boolean) returns boolean language plpgsql set search_path='' as $$
declare l public.listings;k public.listing_management_keys;
begin
 perform account_verification_private.require_admin(p_admin);
 select * into k from public.listing_management_keys where listing_id=p_listing for update;
 select * into l from public.listings where id=p_listing for update;
 if not found or p_approve is null then return false;end if;
 update public.listings set moderation_status=case when p_approve then 'approved' else 'rejected' end,is_active=(p_approve and k.removed_at is null and l.expires_at>now()) where id=p_listing;
 update public.reports set resolved_at=now(),reviewed_by=p_admin where listing_id=p_listing and resolved_at is null;
 return true;
end $$;
revoke all on function public.account_admin_moderate_listing(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.account_admin_moderate_listing(uuid,uuid,boolean) to service_role;

revoke all on all functions in schema account_verification_private from public,anon,authenticated;
grant execute on all functions in schema account_verification_private to service_role;
revoke all on function public.account_prepare_id_upload(uuid,text,text,text),public.account_finish_id_upload(uuid,uuid),public.account_my_id_status(uuid),public.account_admin_id_queue(uuid),public.account_admin_id_file(uuid,uuid),public.account_review_id(uuid,uuid,boolean,text),public.account_withdraw_id(uuid),public.account_claim_id_cleanup(integer),public.account_finish_id_cleanup(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.account_prepare_id_upload(uuid,text,text,text),public.account_finish_id_upload(uuid,uuid),public.account_my_id_status(uuid),public.account_admin_id_queue(uuid),public.account_admin_id_file(uuid,uuid),public.account_review_id(uuid,uuid,boolean,text),public.account_withdraw_id(uuid),public.account_claim_id_cleanup(integer),public.account_finish_id_cleanup(uuid,uuid,boolean) to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('account-government-ids','account-government-ids',false,3145728,array['image/jpeg','image/png','image/webp']);
-- Restrictive guards override any older permissive storage policies. All ID access goes through authenticated admin API.
create policy account_id_storage_read_guard on storage.objects as restrictive for select to anon,authenticated using(bucket_id<>'account-government-ids');
create policy account_id_storage_insert_guard on storage.objects as restrictive for insert to anon,authenticated with check(bucket_id<>'account-government-ids');
create policy account_id_storage_update_guard on storage.objects as restrictive for update to anon,authenticated using(bucket_id<>'account-government-ids') with check(bucket_id<>'account-government-ids');
create policy account_id_storage_delete_guard on storage.objects as restrictive for delete to anon,authenticated using(bucket_id<>'account-government-ids');
commit;
