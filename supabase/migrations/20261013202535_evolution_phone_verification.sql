-- Requires portal_verification_and_monetization.sql. No raw messages/nonce/QR sessions stored.
begin;
create table portal_private.whatsapp_receipts (
  instance text not null check (length(instance) between 1 and 120),
  message_id text not null check (length(message_id) between 1 and 200),
  user_id uuid references public.portal_profiles(user_id) on delete set null,
  received_at timestamptz not null default now(),
  primary key(instance,message_id)
);
alter table portal_private.whatsapp_receipts enable row level security;
revoke all on portal_private.whatsapp_receipts from public,anon,authenticated;
grant all on portal_private.whatsapp_receipts to service_role;
create index portal_whatsapp_receipts_retention on portal_private.whatsapp_receipts(received_at);

create function public.portal_accept_whatsapp_verification(p_actor uuid,p_nonce text,p_sender text,p_instance text,p_message_id text,p_sent_at timestamptz default null) returns text
language plpgsql set search_path='' as $$
declare c portal_private.phone_challenges;
begin
  if p_actor is null or p_nonce is null or p_nonce !~ '^[0-9a-f]{64}$' or p_sender is null or p_sender !~ '^\+91[6-9][0-9]{9}$' or coalesce(length(p_instance),0) not between 1 and 120 or coalesce(length(p_message_id),0) not between 1 and 200 then return 'ignored';end if;
  perform 1 from public.portal_profiles where user_id=p_actor and is_email_verified for update;
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

create function public.portal_phone_verification_status(p_actor uuid,p_challenge uuid default null)
returns table(verified boolean,phone_number text,challenge_status text,expires_at timestamptz)
language plpgsql set search_path='' as $$
declare c portal_private.phone_challenges;
begin
  perform portal_private.require_user(p_actor);
  if p_challenge is not null then select * into c from portal_private.phone_challenges where id=p_challenge and user_id=p_actor;end if;
  return query select p.is_phone_verified,ct.phone_e164,
    case when p_challenge is null then 'idle' when c.id is null then 'unknown' when c.used_at is not null then 'completed' when c.expires_at<=now() then 'expired' else 'pending' end,c.expires_at
    from public.portal_profiles p join portal_private.contacts ct on ct.user_id=p.user_id where p.user_id=p_actor;
end $$;

create function public.portal_prune_whatsapp_receipts() returns void language sql set search_path='' as $$
  delete from portal_private.whatsapp_receipts where received_at<now()-interval '30 days';
$$;
revoke all on function public.portal_accept_whatsapp_verification(uuid,text,text,text,text,timestamptz) from public,anon,authenticated;
revoke all on function public.portal_phone_verification_status(uuid,uuid) from public,anon,authenticated;
revoke all on function public.portal_prune_whatsapp_receipts() from public,anon,authenticated;
grant execute on function public.portal_accept_whatsapp_verification(uuid,text,text,text,text,timestamptz) to service_role;
grant execute on function public.portal_phone_verification_status(uuid,uuid) to service_role;
grant execute on function public.portal_prune_whatsapp_receipts() to service_role;
commit;
-- Apply only after pg_cron exists from the parent migration.
select cron.schedule('portal-whatsapp-receipt-retention','15 1 * * *','select public.portal_prune_whatsapp_receipts();');
