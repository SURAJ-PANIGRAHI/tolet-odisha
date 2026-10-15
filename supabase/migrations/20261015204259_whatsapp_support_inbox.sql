begin;
grant select on public.admin_users to service_role;
create table public.support_settings(id boolean primary key default true check(id),enabled boolean not null default false);
insert into public.support_settings(id,enabled) values(true,false);
create table public.support_sessions(phone text primary key check(phone ~ '^\+91[6-9][0-9]{9}$'),stage text not null default 'menu' check(stage in ('menu','complaint','advertising','human','account','faq','confirm','paused','stopped')),category text, draft text,updated_at timestamptz not null default now());
create table public.support_tickets(id uuid primary key default gen_random_uuid(),reference bigint generated always as identity unique,phone text not null,category text not null check(category in ('complaint','advertising','human')),summary text not null check(length(summary) between 1 and 1500),status text not null default 'open' check(status in ('open','in_progress','resolved')),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),resolved_at timestamptz);
create unique index support_one_open_ticket on public.support_tickets(phone) where status<>'resolved';
create index support_ticket_queue on public.support_tickets(status,created_at desc);
create table public.support_messages(id uuid primary key default gen_random_uuid(),ticket_id uuid not null references public.support_tickets(id) on delete cascade,body text not null check(length(body) between 1 and 1500),created_at timestamptz not null default now());
create index support_message_ticket on public.support_messages(ticket_id,created_at);
create table public.support_receipts(instance text not null,message_id text not null,created_at timestamptz not null default now(),primary key(instance,message_id));
create table public.support_replies(id uuid primary key default gen_random_uuid(),ticket_id uuid references public.support_tickets(id) on delete cascade,phone text not null,body text not null check(length(body) between 1 and 4000),dedupe_key text not null unique,created_at timestamptz not null default now(),available_at timestamptz not null default now(),lease uuid,attempts integer not null default 0,sent_at timestamptz,last_error text);
create index support_reply_pending on public.support_replies(available_at) where sent_at is null;
alter table public.support_messages enable row level security;
alter table public.support_settings enable row level security;
alter table public.support_sessions enable row level security;
alter table public.support_tickets enable row level security;
alter table public.support_receipts enable row level security;
alter table public.support_replies enable row level security;
revoke all on public.support_settings,public.support_sessions,public.support_tickets,public.support_messages,public.support_receipts,public.support_replies from public,anon,authenticated;
grant all on public.support_settings,public.support_sessions,public.support_tickets,public.support_messages,public.support_receipts,public.support_replies to service_role;
grant usage,select on sequence public.support_tickets_reference_seq to service_role;

create function public.support_menu() returns text language sql immutable set search_path='' as $$select E'Namaskar! I’m ToLet Odisha’s automated support assistant.\n\nReply with a number:\n1. Report a problem\n2. Advertise my business\n3. Listings & account help\n4. FAQs\n5. Speak to Support Team\n\nReply 0 for this menu or STOP to stop automated replies. Never share OTPs, passwords, bank details or ID images here. Support tickets are private to authorised administrators.';$$;

create function public.support_receive(p_instance text,p_message_id text,p_phone text,p_text text,p_sent_at timestamptz) returns text language plpgsql set search_path='' as $$
declare s public.support_sessions; t public.support_tickets; answer text; command text:=lower(btrim(p_text)); ticket uuid;
begin
 if not coalesce((select enabled from public.support_settings where id),false) then return 'disabled';end if;
 if p_phone !~ '^\+91[6-9][0-9]{9}$' or length(p_text) not between 1 and 1500 or length(p_message_id) not between 1 and 200 or length(p_instance) not between 1 and 200 or p_sent_at is null or p_sent_at<now()-interval '15 minutes' or p_sent_at>now()+interval '5 minutes' then return 'ignored';end if;
 if p_text ~* '^\s*VERIFY_' or p_text ~ '^\s*[0-9]{4,8}\s*$' or p_text ~* '(otp|passcode|verification code)[^0-9]{0,20}[0-9]{4,8}|password\s*[:=]' then return 'ignored';end if;
 insert into public.support_receipts(instance,message_id) values(p_instance,p_message_id) on conflict do nothing;
 if not found then return 'duplicate';end if;
 if not public.consume_submission_quota('support:'||p_phone,30) or not public.consume_submission_quota('support-global',600) then return 'limited';end if;
 insert into public.support_sessions(phone) values(p_phone) on conflict do nothing;
 select * into s from public.support_sessions where phone=p_phone for update;
 select * into t from public.support_tickets where phone=p_phone and status<>'resolved' for update;
 if command in ('stop','unsubscribe') then
  update public.support_sessions set stage='stopped',draft=null,category=null,updated_at=now() where phone=p_phone;
  update public.support_replies set sent_at=now(),last_error='Recipient stopped automation' where phone=p_phone and sent_at is null and dedupe_key not like 'admin:%';
  answer:='Automated support replies stopped. Send START whenever you want the support menu again.';
 elsif s.stage='stopped' and command not in ('start','menu','0') then return 'stopped';
 elsif t.id is not null then
  if command in ('0','menu','start') then update public.support_sessions set stage='paused',updated_at=now() where phone=p_phone;end if;
  -- During human takeover, store one bounded follow-up on the ticket, never start bot loops.
  if command in ('0','menu','start','5') then
   answer:='Your enquiry TLO-'||t.reference||' is already with the Support Team. Automated replies are paused while they review it.';
  else
   insert into public.support_messages(ticket_id,body) values(t.id,p_text);
   update public.support_tickets set updated_at=now() where id=t.id;
   return 'human_pending';
  end if;
 else
  if s.updated_at<now()-interval '24 hours' then s.stage:='menu';s.draft:=null;s.category:=null;end if;
  if command in ('0','menu','start','hi','hello','namaskar') then
   s.stage:='menu';s.draft:=null;s.category:=null;answer:=public.support_menu();
  elsif command in ('5','human','support team','speak to support team') then
   s.stage:='human';s.category:='human';s.draft:=null;answer:=E'Of course. Briefly describe what you need help with. Do not include passwords, codes, bank details or ID images.\n\nYou can check the summary before sending it to the Support Team.';
  elsif s.stage='confirm' then
   if command in ('1','yes','confirm','send') and s.draft is not null then
    insert into public.support_tickets(phone,category,summary) values(p_phone,s.category,s.draft) returning * into t;
    ticket:=t.id;s.stage:='paused';s.draft:=null;
    answer:='Your enquiry TLO-'||t.reference||E' has been saved for the Support Team. Automated replies are paused while a team member reviews it. You can add a short follow-up here.\n\nPlease allow time for a reply. We do not promise an immediate response.';
   elsif command in ('2','edit') then
    s.stage:=s.category;answer:='Please send the corrected details in one message. Reply 0 to cancel and return to the menu.';
   else answer:=E'Reply 1 to send this enquiry to the Support Team, 2 to edit it, or 0 to cancel.';end if;
  elsif s.stage in ('complaint','advertising','human') then
   if length(btrim(p_text))<8 then answer:='Please add a few more details so the Support Team can help. Reply 0 for the menu.';
   else s.draft:=p_text;s.category:=s.stage;s.stage:='confirm';answer:=E'Please check your enquiry:\n\n'||p_text||E'\n\n1. Confirm and send to Support Team\n2. Edit details\n0. Cancel\n\nNothing has been submitted until you confirm.';end if;
  elsif s.stage='account' then
   answer:=case command
    when '1' then 'Sign in at https://www.toletodisha.in/dashboard using email, Google or WhatsApp, then choose Post Free Listings. Government ID review is optional.'
    when '2' then 'Use the same account you used to post. Open https://www.toletodisha.in/dashboard to edit photos/details or remove a listing when it is rented.'
    when '3' then 'Listings expire after 30 days. Renewal opens near expiry in your dashboard. A verified email receives a reminder three days before expiry: https://www.toletodisha.in/dashboard'
    when '4' then 'Email, WhatsApp and Government ID checks are separate. Government ID review is optional and completed manually within 48 hours. Submit ID images only through your dashboard: https://www.toletodisha.in/dashboard'
    else 'Please reply with 1 (post), 2 (edit/remove), 3 (renew) or 4 (verification). The bot cannot access or change your account.' end||E'\n\nReply 5 to Speak to Support Team, or 0 for the main menu.';
  elsif s.stage='faq' then
   answer:=case command
    when '1' then 'ToLet Odisha takes no rental commission. Confirm any separate charges directly with the advertiser before proceeding.'
    when '2' then 'Badges show which account details were checked. Government ID verification does not establish property ownership or guarantee a listing. Visit the property and verify details independently.'
    when '3' then 'Accepted IDs: Passport, Voter ID, Driving Licence and masked Aadhaar. Review is manual, within 48 hours. Upload only through your dashboard, not WhatsApp support.'
    when '4' then 'A property listing stays live for 30 days unless removed earlier. Renew through your account near expiry. Business advertising placements and prices are discussed personally with the Support Team.'
    else 'Please reply with 1 (commission), 2 (badges), 3 (accepted IDs) or 4 (listing lifetime).' end||E'\n\nReply 5 to Speak to Support Team, or 0 for the main menu.';
  elsif s.stage in ('menu','paused') then
   case command
    when '1' then s.stage:='complaint';s.category:='complaint';answer:=E'Please send one message with:\n• Listing link or title\n• Issue (wrong number, fake/misleading, suspected scam, already rented, duplicate or other)\n• A short explanation\n\nFor a property-specific report, you can also open the property and choose Report listing. The Support Team reviews complaints; the bot does not decide whether someone is a scammer.';
    when '2' then s.stage:='advertising';s.category:='advertising';answer:=E'Business advertising is separate from property listings. Please send:\n• Business name and type\n• District/locality\n• What you want to promote\n• Preferred dates or budget (optional)\n\nThe Support Team will discuss placement, pricing and availability. The bot cannot quote, book or collect payment.';
    when '3' then s.stage:='account';answer:=E'Listings & account help\n1. Post a property\n2. Edit or remove a listing\n3. Renew a listing\n4. Verification help\n5. Speak to Support Team\n0. Main menu';
    when '4' then s.stage:='faq';answer:=E'Common questions\n1. Rental commission\n2. What verification badges mean\n3. Accepted government IDs\n4. Listing lifetime\n5. Speak to Support Team\n0. Main menu';
    else s.stage:='menu';answer:=public.support_menu();
   end case;
  else s.stage:='menu';answer:=public.support_menu();end if;
  update public.support_sessions set stage=s.stage,category=s.category,draft=s.draft,updated_at=now() where phone=p_phone;
 end if;
 if answer is not null then
  insert into public.support_replies(ticket_id,phone,body,dedupe_key) values(ticket,p_phone,answer,p_instance||':'||p_message_id) on conflict do nothing;
 end if;
 return 'accepted';
end $$;

create function public.support_claim_replies(p_limit integer default 5) returns setof public.support_replies language sql set search_path='' as $$
 with claimed as (update public.support_replies r set available_at=now()+interval '5 minutes',attempts=r.attempts+1,lease=gen_random_uuid()
 where r.id in (select q.id from public.support_replies q where (select enabled from public.support_settings where id) and q.sent_at is null and q.available_at<=now() and q.attempts<5 and q.created_at>now()-interval '1 day' order by q.created_at for update skip locked limit least(greatest(p_limit,1),5)) returning r.*) select * from claimed order by created_at,id;
$$;
create function public.support_admin_action(p_admin uuid,p_ticket uuid,p_action text,p_text text default null,p_request uuid default null) returns boolean language plpgsql set search_path='' as $$
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
  update public.support_sessions set stage='menu',draft=null,category=null,updated_at=now() where phone=t.phone;
 else raise exception 'Invalid action';end if;
 return true;
end $$;
create function public.support_cleanup() returns void language plpgsql set search_path='' as $$begin
 delete from public.support_tickets where resolved_at<now()-interval '30 days' or created_at<now()-interval '90 days';
 delete from public.support_sessions where updated_at<now()-interval '7 days';
 delete from public.support_receipts where created_at<now()-interval '7 days';
 delete from public.support_replies where created_at<now()-interval '7 days';
end $$;
revoke all on function public.support_menu(),public.support_receive(text,text,text,text,timestamptz),public.support_claim_replies(integer),public.support_admin_action(uuid,uuid,text,text,uuid),public.support_cleanup() from public,anon,authenticated;
grant execute on function public.support_menu(),public.support_receive(text,text,text,text,timestamptz),public.support_claim_replies(integer),public.support_admin_action(uuid,uuid,text,text,uuid),public.support_cleanup() to service_role;
commit;
