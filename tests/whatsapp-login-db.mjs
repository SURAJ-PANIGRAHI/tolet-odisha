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
const phoneUser='00000000-0000-4000-8000-000000000001',emailUser='00000000-0000-4000-8000-000000000002',unconfirmed='00000000-0000-4000-8000-000000000003';
await db.query("insert into auth.users(id,phone,phone_confirmed_at) values($1,'919876543210',now())",[phoneUser]);
await db.query("insert into auth.users(id,email,email_confirmed_at) values($1,'owner@example.test',now())",[emailUser]);
await db.query("insert into auth.users(id,phone) values($1,'919876543211')",[unconfirmed]);
const q=async(s,p=[]) => (await db.query(s,p)).rows;
await db.exec('set role service_role');
await q('select account_sync_auth_contacts($1)',[phoneUser]);
assert.equal((await q('select * from account_phone_verification_status($1,null)',[phoneUser]))[0].verified,true);
assert.equal((await q('select account_phone_login_allowed($1,$2) ok',[emailUser,'+919876543210']))[0].ok,false,'no account reassignment');
assert.equal((await q('select account_phone_login_allowed($1,$2) ok',[phoneUser,'+919876543210']))[0].ok,true);
await assert.rejects(q('select account_sync_auth_contacts($1)',[unconfirmed]),/Confirmed account/);
const row={title:'Phone login property',category:'Ladies Mess',rent_monthly:1500,deposit:0,district:'Balasore',locality:'Azimabad',contact_name:'Owner Name',contact_phone:'9876543210',images:[],amenities:[]};
const create=async(user,email=null)=>(await q('select submit_account_listing($1::jsonb,$2,$3,gen_random_uuid(),$4) id',[JSON.stringify(row),user,email,'a'.repeat(64)]))[0].id;
const id=await create(phoneUser,'forged@example.test');
let listing=(await q('select * from listings where id=$1',[id]))[0];assert.equal(listing.phone_verified,true);assert.equal(listing.email_verified,false);assert.equal(listing.is_active,true);
assert.equal((await q('select count(*)::int n from listing_owner_contacts where listing_id=$1',[id]))[0].n,0,'no fake email or reminder');
const emailListing=await create(emailUser,'forged@example.test');listing=(await q('select * from listings where id=$1',[emailListing]))[0];assert.equal(listing.email_verified,true);assert.equal(listing.phone_verified,false);
assert.equal((await q('select email from listing_owner_contacts where listing_id=$1',[emailListing]))[0].email,'owner@example.test','confirmed server email wins');
await db.exec('reset role');await q("update auth.users set email='recovery@example.test' where id=$1",[phoneUser]);await db.exec('set role service_role');await q('select account_sync_auth_contacts($1)',[phoneUser]);assert.equal((await q('select email_verified from listings where id=$1',[id]))[0].email_verified,false);
await db.exec('reset role');await q('update auth.users set email_confirmed_at=now() where id=$1',[phoneUser]);await db.exec('set role service_role');await q('select account_sync_auth_contacts($1)',[phoneUser]);listing=(await q('select * from listings where id=$1',[id]))[0];assert.equal(listing.email_verified,true);assert.equal(listing.phone_verified,true);
await q('select account_sync_auth_contacts($1)',[phoneUser]);assert.equal((await q('select count(*)::int n from listing_owner_contacts where listing_id=$1',[id]))[0].n,1,'idempotent email contact sync');
for(let i=0;i<10;i++)assert.equal((await q('select account_allow_otp_delivery($1,$2) status',[phoneUser,'+919876543210']))[0].status,'allowed');assert.equal((await q('select account_allow_otp_delivery($1,$2) status',[phoneUser,'+919876543210']))[0].status,'limited');
for(const role of ['anon','authenticated']){await db.exec('reset role;set role '+role);await assert.rejects(q('select account_sync_auth_contacts($1)',[phoneUser]));await assert.rejects(q('select account_phone_login_allowed($1,$2)',[phoneUser,'+919876543210']));}
console.log('PASS WhatsApp-only accounts: confirmed-phone access, no unverified access, immediate posting, matching-phone badge, optional email, no forged verification/reminders, later email confirmation, account isolation, private RPCs');await db.close();
