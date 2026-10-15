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
await db.exec(readFileSync(new URL('../supabase/migrations/20261015192955_listing_publication_notifications.sql',import.meta.url),'utf8'));
const actor='00000000-0000-4000-8000-000000000001',request='00000000-0000-4000-8000-000000000002';
await db.query("insert into auth.users(id,email,email_confirmed_at,phone,phone_confirmed_at) values($1,'verified@example.test',now(),'919876543210',now())",[actor]);
const row={title:'Test publication',category:'Ladies Mess',rent_monthly:2000,deposit:0,district:'Balasore',locality:'Azimabad',contact_name:'Owner',contact_phone:'9876543211',images:[],amenities:[]};
await db.exec('set role service_role');
const create=async()=>(await db.query('select submit_account_listing($1::jsonb,$2,$3,$4,$5) id',[JSON.stringify(row),actor,'forged@example.test',request,'a'.repeat(64)])).rows[0].id;
const id=await create();assert.equal(await create(),id);
let jobs=(await db.query('select * from notification_jobs where listing_id=$1 order by kind',[id])).rows;
assert.equal(jobs.length,2);assert.equal(jobs[0].kind,'published_email');assert.equal(jobs[0].recipient,'verified@example.test');assert.equal(jobs[1].recipient,'+919876543210');assert(jobs.every(j=>j.body.includes('?listing='+id)&&j.body.includes('/dashboard')&&j.body.includes('Expires:')));
await db.exec('reset role');await db.query('update auth.users set email_confirmed_at=null where id=$1',[actor]);await db.exec('set role service_role');
const second=(await db.query('select submit_account_listing($1::jsonb,$2,null,gen_random_uuid(),$3) id',[JSON.stringify(row),actor,'b'.repeat(64)])).rows[0].id;
jobs=(await db.query('select * from notification_jobs where listing_id=$1',[second])).rows;assert.equal(jobs.length,1);assert.equal(jobs[0].kind,'published_whatsapp');
for(const role of ['anon','authenticated']){await db.exec('reset role;set role '+role);await assert.rejects(db.query('select * from notification_jobs'));await assert.rejects(db.query('select account_verification_private.queue_listing_publication($1,$2)',[id,actor]));}
console.log('PASS atomic publication queue, duplicate submission, verified recipients only, matching links, WhatsApp-only accounts, private queue and RPC');await db.close();
