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
const row = { title: 'Test property', category: 'Boys Mess', rent_monthly: 1000, deposit: 0, district: 'Balasore', locality: 'Test locality', contact_name: 'Test owner', contact_phone: '9876543210', whatsapp_number: '9876543210', amenities: [], images: [] };
await db.exec('set role service_role');
for (const email of [null, '', '   ']) {
  const noEmailId = (await db.query('select public.submit_listing_with_owner($1::jsonb, $2) as id', [JSON.stringify(row), email])).rows[0].id;
  const submitted = (await db.query('select * from listings where id=$1', [noEmailId])).rows[0];
  assert.equal(submitted.moderation_status, 'pending');
  assert.ok(Math.abs(submitted.expires_at.getTime() - Date.now() - 30 * 86400000) < 10000);
  assert.equal((await db.query('select count(*)::int as n from listing_owner_contacts where listing_id=$1', [noEmailId])).rows[0].n, 0);
  assert.equal((await db.query('select count(*)::int as n from notification_jobs where listing_id=$1', [noEmailId])).rows[0].n, 0);
  await db.query('delete from listings where id=$1', [noEmailId]);
}
const id = (await db.query('select public.submit_listing_with_owner($1::jsonb, $2) as id', [JSON.stringify(row), 'test@example.com'])).rows[0].id;
await db.exec('reset role');
let listing = (await db.query('select * from listings where id=$1', [id])).rows[0];
const cycle = listing.expires_at.toISOString();
assert.equal(listing.is_active, false);
assert.equal(listing.moderation_status, 'pending');
assert.ok(Math.abs(Date.parse(cycle) - Date.now() - 30 * 86400000) < 10000);
assert.equal((await db.query('select count(*)::int as n from notification_jobs')).rows[0].n, 1);

async function denied(sql, params = []) { let threw = false; try { await db.query(sql, params); } catch { threw = true; } assert.ok(threw, `Expected denied operation: ${sql}`); }
await db.exec('set role anon');
assert.equal((await db.query('select * from listings')).rows.length, 0);
await denied('select * from listing_owner_contacts');
await denied('select * from notification_jobs');
await denied('select public.submit_listing_report($1, $2, null)', [id, 'fake']);
await denied('insert into reports(listing_id,reason) values($1,$2)', [id, 'fake']);
await db.exec('reset role');
await db.query("update listings set moderation_status='approved', is_active=true where id=$1", [id]);
await db.exec('set role service_role');
await db.query('select public.submit_listing_report($1,$2,$3)', [id, 'wrong_contact', 'Wrong number']);
assert.equal((await db.query('select count(*)::int as n from reports')).rows[0].n, 1);
assert.equal((await db.query('select count(*)::int as n from notification_jobs')).rows[0].n, 2);
await denied('select public.submit_listing_report($1,$2,$3)', [id, 'invalid_reason', 'Test']);
assert.equal((await db.query('select public.consume_submission_quota($1,1) as ok', ['test'])).rows[0].ok, true);
assert.equal((await db.query('select public.consume_submission_quota($1,1) as ok', ['test'])).rows[0].ok, false);
const jobs = (await db.query('select * from public.claim_notification_jobs(20,null)')).rows;
assert.equal(jobs.length, 2);
assert.equal((await db.query('select * from public.claim_notification_jobs(20,null)')).rows.length, 0, 'Lease must prevent concurrent claims');
assert.equal((await db.query('select public.confirm_listing_owner($1,$2,false) as ok', [id, cycle])).rows[0].ok, true);
assert.equal((await db.query('select public.confirm_listing_owner($1,$2,true) as ok', [id, cycle])).rows[0].ok, false, 'Cannot renew too early');
await db.exec('reset role');
const nearExpiry = new Date(Date.now() + 86400000).toISOString();
await db.query('update listings set expires_at=$2 where id=$1', [id, nearExpiry]);
await db.query('update listing_owner_contacts set cycle=$2 where listing_id=$1', [id, nearExpiry]);
await db.exec('set role service_role');
await db.query('select public.run_listing_lifecycle()');
await db.query('select public.run_listing_lifecycle()');
assert.equal((await db.query("select count(*)::int as n from notification_jobs where kind='renewal'")).rows[0].n, 1, 'Reminder must deduplicate');
assert.equal((await db.query('select public.confirm_listing_owner($1,$2,true) as ok', [id, nearExpiry])).rows[0].ok, true);
assert.equal((await db.query('select public.confirm_listing_owner($1,$2,true) as ok', [id, nearExpiry])).rows[0].ok, false, 'Old renewal token cycle must not replay');
await db.exec('reset role');
await db.query("update listings set expires_at=now()-interval '1 second' where id=$1", [id]);
await db.exec('set role anon');
assert.equal((await db.query('select * from listings')).rows.length, 0, 'Expired listing hidden before cron');
await db.exec('reset role');
await db.exec('set role service_role');
await db.query('select public.run_listing_lifecycle()');
assert.equal((await db.query('select is_active from listings where id=$1', [id])).rows[0].is_active, false);
await db.exec('reset role');
await db.query("update listings set moderation_status='rejected' where id=$1", [id]);
const rejectedCycle = (await db.query('select cycle from listing_owner_contacts where listing_id=$1', [id])).rows[0].cycle;
await db.exec('set role service_role');
assert.equal((await db.query('select public.confirm_listing_owner($1,$2,true) as ok', [id, rejectedCycle])).rows[0].ok, false, 'Renewal cannot undo rejection');
await db.close();
console.log('PASS: migrations, pending submission, private contacts/outbox, report validation, quotas, job leases, renewal replay protection, reminder deduplication, expiry and rejection.');
