# ToLet Odisha security review and admin rollout

Reviewed origin/main commit dfbcdf720686b23de804c92e42e6bcb54eb42d90 on 2026-10-11.
www.toletodisha.in returned HTTP 200 with Vercel and HSTS headers. This is an availability check, not a browser end-to-end or live database audit.

## Findings

| Priority | Finding | State |
|---|---|---|
| Critical | PostAdModal explicitly sends is_active=true, contradicting manual approval | Changed to false locally; database enforcement migration prepared |
| Critical | RLS/storage policies absent from repository; live policies unavailable | Unverified; rollout must verify them |
| High | Anonymous uploads/inserts expose storage and database to spam | Still requires server-side submission limits/CAPTCHA; client validation is not abuse protection |
| High | No authenticated admin review workflow | Added Supabase Auth dashboard and admin membership RLS |
| Medium | Upload failures silently skipped | Errors now stop submission; orphaned uploads still need scheduled cleanup |
| Medium | Live schema handoff uses price/photos, code uses rent_monthly/images | Migration targets repository schema; confirm columns before applying |
| Medium | Read failures appear as empty listing feed | Added visible read failure state |
| Medium | Sponsor index stale after changing district | District-keyed banner resets index and timer |
| Medium | PWA has only favicon; no service worker | Installability/offline behavior not established |
| Low | Missing defensive HTTP headers; zoom disabled | Added headers and enabled zoom |

No environment files are tracked in current checkout. This does not prove historical commits never contained credentials. No service-role key is required for the admin dashboard.

## Architecture

/admin uses a separate in-memory Supabase Auth client. Sessions end on reload; passwords are never stored by the app. Access to pending listings and moderation updates is enforced by PostgreSQL RLS, regardless of whether the browser UI is bypassed. The public client remains separate. The dashboard is a client-rendered shell, not a server-side session gate; all sensitive data and authorization live behind the database policies.

admin_users contains explicit administrator UUIDs. Users cannot add themselves or modify membership through the public API. Approval changes moderation_status and is_active atomically. Rejection retains the row for review and unpublishes it. Existing active rows are preserved as approved by the migration; review them manually because earlier submissions may have bypassed approval. The queue processes batches of 100 oldest records.

## Rollout order

1. Back up the database and export existing listings/storage policies. Confirm columns match src/lib/supabase.ts. Test migration in a staging Supabase project first.
2. Deploy the pending-submission frontend change before enforcing the database migration, or schedule a short posting maintenance window. Old cached clients sending is_active=true must be rejected by the migration.
3. Apply supabase/migrations/20261011_moderation.sql once through Supabase SQL editor. It intentionally replaces ALL existing listings policies; review any integrations relying on them. It does not change storage policies or existing listing images.
4. In Supabase Auth, create your administrator account, confirm its email, and turn off public signup if no other accounts are needed. Add its Auth user UUID with SQL (replace placeholder):

   INSERT INTO public.admin_users(user_id) VALUES ('YOUR-ADMIN-AUTH-UUID');

5. Deploy the admin route to Vercel. Existing NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are sufficient. Never put admin passwords or service-role keys into frontend environment variables.
6. Open /admin, sign in, inspect pending listing photos/contact information, then approve. Rejecting an approved listing unpublishes it. Reloading requires sign-in again.

## Mandatory staging permission tests

Use an anonymous client and a second non-admin Auth account; do not test writes against real user listings.

- Anonymous SELECT returns only approved, active rows, including when the is_active frontend filter is removed.
- Anonymous INSERT with is_active=false, is_featured=false and pending status succeeds without requesting RETURNING on the hidden pending row.
- Anonymous INSERT with is_active=true OR is_featured=true OR status=approved/rejected fails.
- Anonymous and ordinary authenticated users cannot UPDATE, DELETE, or read pending/rejected rows.
- Ordinary authenticated users cannot insert/update admin_users or read another membership row.
- An allowlisted admin reads all queues, approves a pending row and rejects an approved row; the public client sees exactly the resulting active approved rows.
- Removing membership immediately prevents subsequent moderation/read requests. Already downloaded data cannot be recalled from a browser.
- A stale concurrent moderation update must report failure rather than success.

## Storage and spam follow-up

The listing-images bucket is reported public. Pending photos therefore remain accessible to anyone with their URL. Public row privacy does not imply photo privacy. Consider private uploads plus approved-photo publication if this matters for owners.

Verify storage INSERT is limited to listing-images and the listings/ prefix, with no anonymous overwrite, UPDATE or DELETE access. Set the bucket's allowed MIME types to JPEG/PNG/WebP and maximum file size to 5 MB; enforce limits in storage, not only the browser. Audit existing broad storage policies before adding rules, since permissive policies combine with OR. Add a server-side upload/submission endpoint with bot verification and durable rate limiting before advertising heavily. A client-only CAPTCHA or disabled submit button is insufficient.

Do not claim live policies are secure until the staging permission matrix and production policy inspection are completed.

## Local verification

- npm run lint: passed with zero errors/warnings.
- npx tsc --noEmit: passed.
- git diff --check: passed.
- Production build: blocked in this execution environment with ENOENT uv_resident_set_memory, including with the alternate Node runtime. Build used placeholder public Supabase values, not production credentials. A successful Vercel/staging build is still required.
- Live RLS tests, Auth login, approval actions and database migration were not executed: no authenticated Supabase access is available.

## Applying the delivered patch

The patch is based on commit dfbcdf720686b23de804c92e42e6bcb54eb42d90. In a clean checkout on a new branch, run git apply --check PATH/TO/tolet-odisha-admin-security.patch, then git apply PATH/TO/tolet-odisha-admin-security.patch. Review the SQL and rollout sequence above before committing/pushing, because main auto-deploys. Do not overwrite uncommitted work to apply the patch.

## Listing reports

ReportModal supports eight reasons and an optional note (required for Other, maximum 1,000 characters). Reports are stored before showing an explicit mailto link to surajpanigrahi.95@gmail.com. The reporter must send the email using their email app; no automatic notification service is configured. On database failure, an email fallback is labelled as not saved. Report records are visible only to allowlisted admins and appear in /admin's latest reports section. Anonymous users cannot read, update or delete reports or choose their IDs/timestamps. Only active approved listings can receive reports.

Apply 20261012_reports.sql AFTER the moderation migration and before deploying the report UI. No reporter IP is collected: client-provided IP values are untrustworthy and unnecessary for this MVP. Permanent records are retained if a listing is rejected; the report foreign key prevents deleting a referenced listing. Anonymous report spam remains a limitation requiring server-side rate limits and bot verification.

Additional staging tests: save each valid reason; require text for Other; reject invalid reason and notes over 1,000 characters; reject missing, pending and rejected listing IDs; anonymous report SELECT/UPDATE/DELETE must fail or return no rows; ordinary authenticated users must not read reports; admins can read records. Confirm failed saves never claim success, double-click submits once, and mailto opens with correctly encoded title/reason/note and requires manual Send. Live email delivery, migration and permissions remain untested.

## Automatic email and 30-day lifecycle (latest local revision)

This revision supersedes the mailto report behavior above. Reports now submit to a server endpoint, which atomically saves the record and queues an automatic email to surajpanigrahi.95@gmail.com. The UI never asks the reporter to contact the administrator. Failed delivery stays queued and retries; a successfully saved report is not falsely labelled unsaved because the provider is unavailable. This is at-least-once delivery, not an exactly-once guarantee: provider idempotency expires after 24 hours, and a provider success followed by a database failure can result in a duplicate during a later retry.

New listings require an owner email, stored in a server-only table rather than the publicly readable listings row. A confirmation email establishes control of that inbox. Verified owners receive a reminder in the two days before expiry. A signed link allows renewal near expiry or within seven days after expiry, resets the lifetime to 30 days from renewal, cannot replay after renewal, and cannot reactivate a rejected listing. GET requests never renew automatically, preventing email scanners from renewing ads. Opening a link must be followed by an explicit button press. Signed-link possession grants control of that listing's renewal; treat links as credentials.

The lifetime is 30 days from submission, including pending review time. Expired rows are hidden by database RLS immediately on subsequent reads; open browser feeds filter them every 30 seconds. A daily Vercel job deactivates expired listings and queues reminders. Records/photos are retained for moderation rather than permanently deleted. Existing listings have no email and cannot receive renewal reminders until their owners provide a verified contact address. Existing rows inherit created_at + 30 days when the migration runs.

Migration order: moderation, reports, automated lifecycle. The last migration REVOKES direct browser INSERT on listings/reports: deploy the new server-backed frontend in a coordinated maintenance window or a staging environment first. Applying it while the old production frontend is active will break new submissions. Do not apply any migration blindly to production.

Server-only configuration: SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, EMAIL_FROM (verified sender), APP_URL, CRON_SECRET and RENEWAL_SIGNING_SECRET (at least 32 random characters). Keep all secrets out of NEXT_PUBLIC_ variables. Vercel Cron calls the authenticated lifecycle route once daily at 03:00 UTC, with Hobby execution potentially delayed within the hour. This endpoint does not run automatically on localhost. Set APP_URL=http://localhost:3001 for local links; run against a staging database, not production.

Dispatch is capped at five queued messages per daily cron invocation (new reports and confirmations also attempt immediate delivery). This is suitable for the current two-listing pilot, not broad expansion. Monitor backlog and dead-letter jobs (attempts >= 10), and replace the pilot dispatcher with a higher-throughput worker before growth. No email has been sent or production migration applied in this session.

Server endpoints apply durable global hourly quotas (100 reports, 50 submissions, 500 renewal requests). These cap volume but do not stop a bot from exhausting the shared quota; CAPTCHA and per-client limits remain necessary for stronger abuse prevention. Public storage uploads still need server-side limits and bot protection.

## Confirmed live audit

Supabase project vtcavjywornwfidbbupo has only public.listings and two active records. is_active defaults to true. The public INSERT policy has WITH CHECK true, confirming the approval bypass is currently allowed. SELECT is limited to active rows. No public UPDATE/DELETE policies were found, despite broad table grants; those operations are normally blocked by RLS, while TRUNCATE grants warrant removal because TRUNCATE is not governed by row policies. The bucket permits anyone to INSERT into listing-images, is public, and has no size or MIME limits. Security advisors returned no lints; that does not negate these application-specific findings.

Vercel project inspection succeeded. Scoped domain inspection returned 403 forbidden for the suraj-panigrahi account scope, and no authenticated local Vercel CLI is available. Domain setup through that connection is not currently possible.

Resend lists toletodisha.in with status not_started. Add the displayed DKIM TXT record resend._domainkey and CNAME records rsend/send at the authoritative DNS provider, then verify in Resend. No DNS records have been changed here.
