begin;
-- Resolving a ticket must never undo a sender's STOP preference.
create or replace function public.support_admin_action(p_admin uuid,p_ticket uuid,p_action text,p_text text default null,p_request uuid default null) returns boolean language plpgsql set search_path='' as $$
declare t public.support_tickets;
begin
 if not exists(select 1 from public.admin_users where user_id=p_admin) then raise exception 'Administrator required';end if;
 select * into t from public.support_tickets where id=p_ticket for update;if not found then return false;end if;
 if p_action='reply' then
  if p_request is null or t.status='resolved' or length(btrim(p_text)) not between 1 and 1500 or p_text is null then raise exception 'Invalid reply';end if;
  if not public.consume_submission_quota('support-admin:'||p_admin::text,60) then raise exception 'Reply limit reached';end if;
  insert into public.support_replies(ticket_id,phone,body,dedupe_key) values(t.id,t.phone,E'ToLet Odisha Support Team\n\n'||p_text,'admin:'||p_admin::text||':'||t.id::text||':'||p_request::text) on conflict(dedupe_key) do nothing;
  update public.support_tickets set status='in_progress',updated_at=now() where id=t.id;
 elsif p_action='resolve' then
  update public.support_tickets set status='resolved',resolved_at=now(),updated_at=now() where id=t.id;
  update public.support_sessions set stage='menu',draft=null,category=null,updated_at=now() where phone=t.phone and stage<>'stopped';
 else raise exception 'Invalid action';end if;
 return true;
end $$;
commit;
