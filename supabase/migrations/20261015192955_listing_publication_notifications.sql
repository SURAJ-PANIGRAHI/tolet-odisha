begin;
alter table public.notification_jobs drop constraint notification_jobs_kind_check;
alter table public.notification_jobs add constraint notification_jobs_kind_check check(kind in ('report','verify','renewal','published_email','published_whatsapp'));

create function account_verification_private.queue_listing_publication(p_listing uuid,p_actor uuid) returns void
language plpgsql security definer set search_path='' as $$
declare u auth.users; l public.listings; message text; number text;
begin
 perform account_verification_private.require_account(p_actor);
 select * into u from auth.users where id=p_actor;
 select x.* into l from public.listings x join public.listing_management_keys k on k.listing_id=x.id
 where x.id=p_listing and k.verified_user=p_actor and x.is_active and x.moderation_status='approved';
 if not found then return;end if;
 message:='Your property is live on ToLet Odisha!'||E'\n\n'||l.title||E'\nExpires: '||to_char(l.expires_at at time zone 'Asia/Kolkata','DD Mon YYYY, HH12:MI AM')||' IST'||E'\n\nView listing: https://www.toletodisha.in/?listing='||l.id||E'\n\nManage My Listings: https://www.toletodisha.in/dashboard'||E'\n\nSign in to edit photos, update details or remove your listing. Your listing expires automatically after 30 days.';
 if u.email_confirmed_at is not null and nullif(u.email,'') is not null then
  insert into public.notification_jobs(dedupe_key,listing_id,kind,recipient,subject,body)
  values('published:email:'||l.id,l.id,'published_email',lower(u.email),'Your property is live on ToLet Odisha',message) on conflict(dedupe_key) do nothing;
 end if;
 select phone_e164 into number from account_verification_private.phones where user_id=p_actor and verified_at is not null;
 if number ~ '^\+91[6-9][0-9]{9}$' then
  insert into public.notification_jobs(dedupe_key,listing_id,kind,recipient,subject,body)
  values('published:whatsapp:'||l.id,l.id,'published_whatsapp',number,'Your property is live on ToLet Odisha',message) on conflict(dedupe_key) do nothing;
 end if;
end $$;
revoke all on function account_verification_private.queue_listing_publication(uuid,uuid) from public,anon,authenticated;
grant execute on function account_verification_private.queue_listing_publication(uuid,uuid) to service_role;
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
 perform account_verification_private.queue_listing_publication(new_id,p_user);
 return new_id;
exception when unique_violation then
 select listing_id into new_id from public.listing_management_keys where verified_user=p_user and submission_id=p_request;
 if found then return new_id;end if;
 raise;
end $$;
commit;
