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
await db.exec(`alter table listings enable row level security; grant select,insert on listings to anon; create policy "legacy read" on listings for select to anon using(is_active=true); create policy "legacy insert" on listings for insert to anon with check(true);`);
await db.exec(readFileSync(new URL('../supabase/rollout/backend.sql',import.meta.url),'utf8'));
await db.exec('set role anon');
await db.query("insert into listings(title,category,rent_monthly,district,locality,contact_name,contact_phone,is_active) values('Legacy test','Boys Mess',1000,'Balasore','Test','Test','9876543210',true)");
assert.equal((await db.query('select * from listings')).rows.length,1);
await db.exec('reset role');
await db.exec(readFileSync(new URL('../supabase/rollout/cutover.sql',import.meta.url),'utf8'));
await db.exec('set role anon');
assert.equal((await db.query('select * from listings')).rows.length,1);
let denied=false;try{await db.query("insert into listings(title,category,rent_monthly,district,locality,contact_name,contact_phone) values('Blocked','Boys Mess',1000,'Balasore','Test','Test','9876543210')");}catch{denied=true;}assert.ok(denied);
await db.close(); console.log('PASS: staged backend preserves legacy submissions; cutover preserves existing listings and blocks direct inserts.');
