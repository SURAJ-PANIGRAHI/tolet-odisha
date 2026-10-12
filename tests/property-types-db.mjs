// Run with PGLITE_MODULE=/absolute/path/to/@electric-sql/pglite/dist/index.js node tests/lifecycle-db.mjs
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const { PGlite } = await import(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const db = new PGlite();
await db.exec(`
create role anon;
create role authenticated;
create role service_role bypassrls;
create schema auth;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to authenticated;
grant execute on function auth.uid() to authenticated;
create table public.listings (
id uuid primary key default gen_random_uuid(), created_at timestamptz default now(), title text not null, description text, category text not null, rent_monthly integer not null, deposit integer default 0, district text not null, locality text not null, landmark text, contact_name text not null, contact_phone text not null, whatsapp_number text, images text[] default '{}', amenities text[] default '{}', is_featured boolean default false, is_active boolean default true
);
`);
for (const file of ['20261011_moderation.sql', '20261012_reports.sql', '20261012_automated_lifecycle.sql']) await db.exec(readFileSync(new URL(`../supabase/migrations/${file}`, import.meta.url), 'utf8'));
await db.exec(readFileSync(new URL('../supabase/rollout/optional_owner_email.sql', import.meta.url), 'utf8'));
await db.exec(readFileSync(new URL('../supabase/rollout/owner_removal.sql', import.meta.url), 'utf8'));
await db.exec(readFileSync(new URL('../supabase/rollout/three_day_reminders.sql', import.meta.url), 'utf8'));
await db.exec(readFileSync(new URL('../supabase/rollout/phone_verified_posting.sql', import.meta.url), 'utf8'));
await db.exec(readFileSync(new URL('../supabase/rollout/email_verified_publishing.sql', import.meta.url), 'utf8'));

await db.exec('alter table listings add constraint listings_category_check check (true)');
const { readdirSync } = await import('node:fs');
const migration = readdirSync(new URL('../supabase/migrations/', import.meta.url)).find(name => name.endsWith('_property_types_and_area.sql'));
await db.exec(readFileSync(new URL('../supabase/migrations/' + migration, import.meta.url), 'utf8'));
const base={title:'Area test',category:'Commercial / Shop',rent_monthly:25000,deposit:0,district:'Balasore',locality:'Test',contact_name:'Test',contact_phone:'9876543210',images:[],amenities:[]};
await db.exec('set role service_role');
for (const type of ['Office Space','Bank / ATM Space','Warehouse / Godown']) {
 const id=(await db.query('select submit_managed_listing($1::jsonb,null,$2) id',[JSON.stringify({...base,commercial_type:type,area_sqft:2100}),'a'.repeat(64)])).rows[0].id;
 const row=(await db.query('select * from listings where id=$1',[id])).rows[0];assert.equal(row.commercial_type,type);assert.equal(row.area_sqft,2100);assert.equal(row.is_active,true);assert.equal(row.email_verified,false);
}
for (const category of ['Ladies Mess','Paying Guest (PG)','Girls Hostel','Commercial / Shop']) {
 await db.query('select submit_managed_listing($1::jsonb,null,$2)',[JSON.stringify({...base,category}),'b'.repeat(64)]);
}
for (const bad of [{area_sqft:-1},{area_sqft:0},{commercial_type:'Invalid',area_sqft:100},{category:'Ladies Mess',commercial_type:'Office Space',area_sqft:100}]) await assert.rejects(db.query('select submit_managed_listing($1::jsonb,null,$2)',[JSON.stringify({...base,...bad}),'c'.repeat(64)]));
await db.exec('set role anon');
assert.equal((await db.query('select area_sqft from listings where commercial_type is not null')).rows.length,3);
await assert.rejects(db.query('select submit_managed_listing($1::jsonb,null,$2)',[JSON.stringify(base),'d'.repeat(64)]));
await db.close();console.log('PASS: property type/area persistence, legacy ads, PG/Ladies Mess, invalid data and public permissions');
