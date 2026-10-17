import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import assert from 'node:assert/strict';
process.on('uncaughtException',e=>{console.error(e.message,e.where||'');process.exit(1);});
const db=new PGlite({extensions:{pgcrypto}});
const original=readFileSync(new URL('./lifecycle-db.mjs',import.meta.url),'utf8');
await db.exec(original.split('await db.exec(`')[1].split('`);')[0]);
for(const name of ['20261011_moderation.sql','20261012_reports.sql','20261012_automated_lifecycle.sql'])await db.exec(readFileSync(new URL('../supabase/migrations/'+name,import.meta.url),'utf8'));
for(const name of ['optional_owner_email.sql','owner_removal.sql','three_day_reminders.sql','phone_verified_posting.sql','email_verified_publishing.sql'])await db.exec(readFileSync(new URL('../supabase/rollout/'+name,import.meta.url),'utf8'));
await db.exec('alter table listings add constraint listings_category_check check (true)');
for(const name of ['20261012173735_property_types_and_area.sql','20261013045152_optional_property_area.sql','20261014133327_advertiser_accounts.sql'])await db.exec(readFileSync(new URL('../supabase/migrations/'+name,import.meta.url),'utf8'));

await db.exec("alter table auth.users add column email_confirmed_at timestamptz,add column is_anonymous boolean default false;create schema if not exists extensions;create extension pgcrypto with schema extensions;");
await db.exec(readFileSync(new URL('../supabase/migrations/20261015120600_account_whatsapp_verification.sql',import.meta.url),'utf8'));

await db.exec(`create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;grant usage on schema storage to anon,authenticated,service_role;grant all on storage.objects to anon,authenticated,service_role;create policy legacy_access on storage.objects for all using(true) with check(true);`);
await db.exec(readFileSync(new URL('../supabase/migrations/20261015125920_account_government_id_review.sql',import.meta.url),'utf8'));

await db.exec("alter table auth.users add column email text,add column phone text,add column phone_confirmed_at timestamptz");
await db.exec(readFileSync(new URL('../supabase/migrations/20261015135959_whatsapp_account_login.sql',import.meta.url),'utf8'));

await db.exec("alter table auth.users add column phone_change text");
for(const name of ['20261015192955_listing_publication_notifications.sql','20261016193616_listing_negotiable_rent_and_separate_whatsapp.sql','20261016195804_shared_listing_phone_and_verified_number_changes.sql'])await db.exec(readFileSync(new URL('../supabase/migrations/'+name,import.meta.url),'utf8'));
await db.exec(readFileSync(new URL('../supabase/rollout/msg91_phone_auth.sql',import.meta.url),'utf8'));
const q=async(sql,args=[]) => (await db.query(sql,args)).rows;
const smsUser='00000000-0000-4000-8000-000000000001',waUser='00000000-0000-4000-8000-000000000002',emailUser='00000000-0000-4000-8000-000000000003';
await q("insert into auth.users(id,phone,phone_confirmed_at) values($1,'919876543210',now()),($2,'919876543211',now())",[smsUser,waUser]);
await q("insert into auth.users(id,email,email_confirmed_at) values($1,'owner@example.test',now())",[emailUser]);
await db.exec('set role service_role');
await q('select account_sync_auth_contacts($1)',[waUser]);
await q('select sms_auth_record($1,$2)',[smsUser,'+919876543210']);
await q('select account_sync_auth_contacts($1)',[smsUser]);
assert.equal((await q('select * from account_phone_verification_status($1,null)',[smsUser]))[0].verified,false,'SMS does not grant WhatsApp verification');
assert.equal((await q('select * from sms_auth_status($1)',[smsUser]))[0].phone_e164,'+919876543210');
assert.equal((await q('select * from account_phone_verification_status($1,null)',[waUser]))[0].verified,true);
assert.equal((await q('select * from sms_auth_status($1)',[waUser])).length,0,'WhatsApp does not grant SMS verification');
await assert.rejects(q('select sms_auth_record($1,$2)',[emailUser,'+919876543210']),/already linked/);
await assert.rejects(q('select sms_auth_record($1,$2)',[emailUser,'+919876543211']),/already linked/);
const nonce='a'.repeat(64),proof='b'.repeat(64);
const id=(await q('select sms_auth_begin($1,$2,null,$3) id',[nonce,'+919876543212','login']))[0].id;
await assert.rejects(q('select sms_auth_begin($1,$2,null,$3)',['c'.repeat(64),'+919876543212','login']),/60 seconds/);
assert.equal((await q('select * from sms_auth_challenge($1,$2,null)',[id,'d'.repeat(64)])).length,0,'nonce binding');
assert.equal((await q('select * from sms_auth_challenge($1,$2,$3)',[id,nonce,emailUser])).length,0,'actor binding');
assert.equal((await q('select sms_auth_consume($1,$2,null,$3,$4) ok',[id,nonce,'+919876543213',proof]))[0].ok,false,'destination binding');
assert.equal((await q('select sms_auth_consume($1,$2,null,$3,$4) ok',[id,nonce,'+919876543212',proof]))[0].ok,true);
assert.equal((await q('select sms_auth_consume($1,$2,null,$3,$4) ok',[id,nonce,'+919876543212',proof]))[0].ok,false,'one-time challenge');
const id2=(await q('select sms_auth_begin($1,$2,null,$3) id',['e'.repeat(64),'+919876543213','login']))[0].id;
assert.equal((await q('select sms_auth_consume($1,$2,null,$3,$4) ok',[id2,'e'.repeat(64),'+919876543213',proof]))[0].ok,false,'proof cannot replay across challenges');
await q('select sms_auth_exchange_begin($1,$2,$3)',[smsUser,'+919876543210',nonce]);
assert.equal((await q('select sms_auth_exchange_capture($1,$2,$3) ok',[waUser,'+919876543210','forged']))[0].ok,false);
assert.equal((await q('select sms_auth_exchange_capture($1,$2,$3) ok',[smsUser,'+919876543211','forged']))[0].ok,false);
assert.equal((await q('select sms_auth_exchange_capture($1,$2,$3) ok',[smsUser,'+919876543210','ciphertext']))[0].ok,true);
assert.equal((await q('select sms_auth_exchange_capture($1,$2,$3) ok',[smsUser,'+919876543210','retry-ciphertext']))[0].ok,true,'hook retry acknowledged without WhatsApp delivery');
assert.equal((await q('select sms_auth_exchange_take($1,$2) value',[smsUser,'x'.repeat(64)]))[0].value,null);
assert.equal((await q('select sms_auth_exchange_take($1,$2) value',[smsUser,nonce]))[0].value,'ciphertext');
assert.equal((await q('select sms_auth_exchange_take($1,$2) value',[smsUser,nonce]))[0].value,null);
const row={title:'Separate numbers',category:'Ladies Mess',rent_monthly:1500,deposit:0,district:'Balasore',locality:'Azimabad',contact_name:'Owner Name',contact_phone:'9876543210',whatsapp_number:'9876543212',images:[],amenities:[]};
const listing=(await q('select submit_account_listing($1::jsonb,$2,null,gen_random_uuid(),$3) id',[JSON.stringify(row),smsUser,'a'.repeat(64)]))[0].id;
let item=(await q('select * from listings where id=$1',[listing]))[0];assert.equal(item.call_verified,true);assert.equal(item.phone_verified,false);assert.equal(item.email_verified,false);assert.equal(item.is_active,true);
await assert.rejects(q('select manage_account_listing($1,$2,$3,$4::jsonb)',[smsUser,listing,'edit',JSON.stringify({...row,contact_phone:'9876543214'})]),/verified Phone/);
// Email users can publish before verifying either number.
const emailListing=(await q('select submit_account_listing($1::jsonb,$2,null,gen_random_uuid(),$3) id',[JSON.stringify({...row,contact_phone:'9876543214'}),emailUser,'b'.repeat(64)]))[0].id;
item=(await q('select * from listings where id=$1',[emailListing]))[0];assert.equal(item.call_verified,false);assert.equal(item.phone_verified,false);assert.equal(item.email_verified,true);assert.equal(item.is_active,true);
// A call-number change invalidates old listing badges without editing the ads.
await q('select sms_auth_record($1,$2)',[smsUser,'+919876543215']);
assert.equal((await q('select call_verified from listings where id=$1',[listing]))[0].call_verified,false);
// A client cannot turn SMS verification into WhatsApp verification.
assert.equal((await q('select account_confirm_whatsapp_otp($1,$2,$3) ok',[smsUser,'+919876543210','fake']))[0].ok,false);
for(const role of ['anon','authenticated']){await db.exec('reset role;set role '+role);await assert.rejects(q('select sms_auth_status($1)',[smsUser]));await assert.rejects(q('select * from account_verification_private.sms_phones'));await assert.rejects(q('select sms_auth_exchange_take($1,$2)',[smsUser,nonce]));}
console.log('PASS MSG91 database: separate badges, unique identity, challenge actor/nonce/destination binding, 60-second limit, proof replay prevention, private encrypted hand-off, hook idempotency, independent posting contacts, SMS badge invalidation and RLS');
await db.close();
