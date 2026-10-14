> Application update: `application-preview-setup.md` and the application-flows migration supersede the original verified-email posting requirement described below. Guest posting is now supported; passport is also accepted.

# ToLet Odisha portal v2: migration and integration contract

## Scope and deployment status

This is an additive, **not yet applied** migration for the next authenticated portal.
It creates `public.portal_*` tables/RPCs and the unexposed `portal_private` schema.
It does not overwrite or migrate the live anonymous `public.listings` workflow.
The existing site continues working until a coordinated UI/API cutover.
Apply the migration to staging first; do not blindly switch production tables.

Files:
- `supabase/migrations/20261013190355_portal_verification_and_monetization.sql`
- `supabase/functions/portal-id-cleanup/index.ts`
- `tests/portal-v2-db.mjs` (portable DB/RLS tests)
- `tests/portal-cleanup-worker.mjs` (worker security and Storage API ordering tests)

## Business rules

| Product | Price | Scope / duration |
|---|---:|---|
| Free | ₹0 | One active listing per account; repeat 30-day renewal is free |
| Boost | ₹29 | One property, 30 days from approval; extra purchases extend remaining time |
| Multi-listing | ₹49 | Account-level, multiple simultaneous listings, 30 days from approval |

Boost is separate from the multi-listing allowance. Renewing a listing does not extend
any purchased product. Expired packs immediately hide paid extra slots through RLS;
the daily job retains the oldest active listing for free and deactivates the rest.
A quarantined/rejected ad cannot be renewed by its host or a bearer token.
An account row lock serializes activation, renewal, plan approval and cleanup.

## Step 1: confirm prerequisites

1. Staging project runs Postgres 15+ (security-invoker views).
2. `pgcrypto` is installed in `extensions`; `pg_cron`, `pg_net`, Vault available.
3. Keep `portal_private` OUT of Supabase Data API exposed schemas.
4. Confirm the IDFC account/VPA is authorised to collect this business's platform
   revenue. An NRO account's ability to receive INR is not by itself confirmation
   that it is the appropriate account for revenue of an Irish entity. No bank
   suitability, tax, GDPR or DPDP certification is implied by this code.
5. Decide/document lawful basis, optional ID-upload consent, masked documents,
   reviewer access, retention, subject rights and backup retention before launch.
   Do not request full Aadhaar numbers; no ID numbers are stored in SQL.

## Step 2: Auth and migration

1. Configure Supabase Auth Magic Link and/or Google OAuth; email confirmation ON.
   Add staging/production redirect URLs. Disable anonymous signup for this portal.
2. Apply the migration using the standard Supabase migration workflow.
3. Enable Data API grants for the `public.portal_*` tables as in this script.
4. Provision real admin membership using SQL (not browser metadata):

```sql
insert into portal_private.admins(user_id)
select id from auth.users where email='YOUR_ACTUAL_ADMIN_EMAIL'
on conflict do nothing;
```

This is independent of the older site's `public.admin_users` list. Confirm the selected
Auth identity before granting it. Do not let users select their own admin role.

Auth triggers set `is_email_verified` from `auth.users.email_confirmed_at` and reject
anonymous Auth identities. Choosing Google alone or setting `user_metadata` is not proof.
Public-safe profiles expose name/badges only; phones and document paths are private.
Clients can only edit their own display name. Name changes revoke the ID badge until
another manual review. Neither payment nor email verification verifies a property.

## Step 3: WhatsApp with no messaging API

The recipient of `wa.me` is **the portal's monitored WhatsApp number**, not the
advertiser's number. There is no reliable automatic incoming-message callback from
a free click-to-chat link. This version uses manual admin confirmation.

1. Validated-session server calls `portal_create_phone_challenge(actor, '+91...')`.
2. Frontend encodes returned text in:
   `https://wa.me/<PORTAL_BUSINESS_NUMBER>?text=<ENCODED_VERIFICATION_TEXT>`.
3. Text includes `VERIFY_<USER_ID>_<RANDOM_NONCE>`, valid 30 minutes, one use.
4. Admin checks the actual sender number in WhatsApp against the challenge.
5. Admin endpoint calls `portal_confirm_phone(admin, actor, nonce, observed_sender)`.
6. Only then display `Phone Verified ✅`. Changing the claimed number revokes it.

Never treat a link click, screenshot, client boolean or user ID alone as verification.
A verified phone confirms control of that number, not legal identity/property ownership.
Automated verification would require a supported WhatsApp API and its applicable fees.

## Step 4: private ID upload/review

- Bucket: `portal-government-ids`, private, 5 MB, JPEG/PNG/WebP.
- Browser has NO bucket read/list/upload permissions, including its own documents.
- A validated server endpoint uploads a generated `<user-id>/<random-file-name>` key
  with the service client, validates bytes/MIME/size and registers it using
  `portal_register_id_upload`. If registration fails, immediately remove that upload
  through the Storage API; schedule retry if removal fails. Never log image content.
- Store object keys, not public or long-lived signed URLs. `id_document_url` is private.
- Status endpoint: `portal_my_id_status(actor)` returns status/rejection only.
- Show `Verification Pending (Up to 48 Hours)` as an operational review target,
  not an automatic approval timer. Admin queue is ordered by submission time.
- Admin endpoint calls `portal_admin_pending_ids(admin)`, generates short-lived
  read URLs (e.g. 60 seconds), displays image alongside account name.
- Decisions use `portal_review_id`: approve or one of Blurry image / Name mismatch /
  Incomplete ID. Manual visual review is not government/UIDAI authentication.
- Approve displays `Govt ID Verified 🛡️`, with wording explaining manual document
  review and that it does not establish property ownership or guarantee safety.

## Step 5: UPI intents, QR and manual bank reconciliation

1. Call `portal_create_payment` first. Use returned request ID and stored
   `amount_paise`, never a client-supplied price, to construct the intent and QR.
2. Use configured actual merchant VPA/name; placeholders must not go live:
   `upi://pay?pa=7428975781@idfcfirst&pn=Suraj%20Panigrahi&am=29.00&cu=INR&tn=<PAYMENT_REQUEST_ID>`.
   Requested payee: Suraj Panigrahi. Bank authorisation for this business collection
   arrangement must be confirmed before live checkout is enabled.
   Multi-listing uses `49.00`. URL-encode each parameter. QR encodes that same URI.
3. User submits exactly 12 digits to `portal_submit_utr`. Status stays pending.
4. Admin checks the actual credit in the bank account/statement, amount, UTR and
   receipt time. A notification helps locate the credit but is not a bank webhook.
   Screenshots, UTR input and returning from a UPI app alone never approve a plan.
5. Admin calls `portal_review_payment` with the observed bank data. Approval adds
   a unique bank-receipt ledger row and entitlement atomically; repeated approval
   does not extend it again. Reject with a recorded explanation when unmatched.

Multiple users may CLAIM the same UTR, so a fake claimant cannot reserve it. Only one
request can receive credit for a bank-verified UTR. The bank's verified payment data
must identify the correct request/payer if there are conflicting claims. Do not
approve whichever user submitted first. The portal's ₹29/₹49 products are NOT KYC.

## Step 6: listing APIs/UI contract (next implementation phase)

Every route validates session using Supabase Auth `getUser`/verified server claims.
Use caller's validated UUID; ignore any actor/user/admin IDs from request bodies.
Check Origin/CSRF for mutations, request size, rate limits, ownership and payload
allowlists. Service keys stay server-only. Admin routes check membership server-side.

| HTTP route | Backend contract |
|---|---|
| POST `/api/listings` | `portal_save_listing(actor, payload, null, activate)` |
| PATCH `/api/listings/:id` | `portal_save_listing(actor, full permitted payload, id)` |
| POST `/api/listings/:id/remove` | `portal_remove_listing(actor,id)` |
| POST `/api/listings/:id/renew` | `portal_renew_listing(actor,id)` |
| GET `/api/renew-listing?token=...` | Render renewal confirmation; NEVER mutate on GET |
| POST `/api/renew-listing` | `portal_redeem_renewal_token(token)`; CSRF/rate limit |
| POST `/api/verification/whatsapp` | `portal_create_phone_challenge(actor,phone)` |
| POST `/api/admin/verification/phone` | `portal_confirm_phone(admin,...)` |
| POST `/api/verification/id` | Server upload + `portal_register_id_upload` |
| GET `/api/verification/id` | `portal_my_id_status(actor)` |
| GET `/api/admin/verification/ids` | `portal_admin_pending_ids(admin)` + short read URLs |
| POST `/api/admin/verification/ids/:id` | `portal_review_id(admin,...)` |
| POST `/api/payments` | `portal_create_payment(actor,kind,listing)` |
| POST `/api/payments/:id/utr` | `portal_submit_utr(actor,id,utr)` |
| POST `/api/admin/payments/:id` | `portal_review_payment(admin,...)` |
| POST `/api/reports` | `portal_report_listing(actor,listing,reason,note)` |
| POST `/api/admin/listings/:id/moderate` | `portal_moderate_listing(admin,listing,approve)` |

The GET renewal confirmation prevents email/WhatsApp preview crawlers from extending
ads. Token links are expiring, single-use, and bound to the listing's expiry cycle;
an authenticated host can issue/renew repeatedly without paying a renewal fee, but
must still have a pack when activating more than one simultaneous ad.

Dashboard reads own rows with the user's session and RLS, shows Edit / Renew / Remove,
pending-payment state, plan expiry and badges. A second activation returns
`MULTI_LISTING_PACK_REQUIRED`; save a draft with activate=false or offer ₹49 checkout.
A draft does not occupy a free active slot. All API mutation RPCs are service-only.
Do not call them from browser `supabase.rpc` or expose a generic arbitrary-RPC proxy.

Reports require two DISTINCT confirmed-email accounts. Same reporter cannot increment
twice, self-reports are rejected, and report submissions are capped at five/day/account.
Two reports quarantine the ad even if boosted. This threshold can still be abused by
multiple accounts; admin review remains necessary. Review clears/rejects quarantine;
only explicit host renewal republishes a cleared listing after capacity checks.

Query `portal_ranked_listings` with explicit `.order('ranking_score', {ascending:false})`
and `.order('created_at', {ascending:false})`, then stable ID ordering/pagination.
This view is security-invoker. Scores: active boost 1000, manually-reviewed ID 200,
phone 100, email 50, recency max(0,30-day-age). Boost expiry removes points automatically.
Featured/paid badges explain placement; verification badges explain their limited scope.
No signed URLs, ID details or unconfirmed payment claims go into public search results.

## Step 7: activate real deletion

SQL cannot physically delete Storage files. Deleting `storage.objects` metadata would
orphan the object. A server worker MUST call Storage `.remove` first and only then
acknowledge the durable cleanup job. The migration never deletes Storage rows.

1. Deploy `portal-id-cleanup` Edge Function with JWT gateway verification disabled
   for this endpoint (`--no-verify-jwt`); its own long random cron secret is mandatory.
2. Set Edge secret `PORTAL_CLEANUP_SECRET` (32+ characters, randomly generated).
3. In Supabase Vault, set `portal_cleanup_secret` to that same value and
   `portal_cleanup_url` to the deployed HTTPS worker URL. Keep secrets out of git/chat.
4. Daily cron at 01:00 UTC (06:30 IST) runs DB maintenance and invokes the worker.
   An hourly job retries pending/failed removal; batch size is 20.
5. Before enabling production collection, verify a test file is physically gone
   and its metadata path is NULL after the worker succeeds. Monitor cron/worker
   failures: durable jobs by themselves do not establish a retention guarantee.

Grace is based on a stable `inactive_since`, not `updated_at`. All ads for an account
must be inactive for seven days; edits cannot reset the clock. Rejected IDs are queued
immediately. Deleting an account queues its files before cascade deletion.
Active renewal cancels pending inactivity cleanup. Once physical deletion starts,
activation waits until cleanup finishes; failed requests retry under a lease.
ID review attestation/date may remain after raw-image deletion, while name changes
remove the ID badge. Decide/document that minimal evidence retention separately.

This is API deletion, NOT cryptographic erasure. Provider backups, signed-URL lifetime,
logs and actual encryption-key destruction require separate retention controls.
GDPR/DPDP compliance needs an operational/legal assessment, not just RLS + a cron.

## Validation and cutover checklist

Run `node tests/portal-v2-db.mjs` and `node tests/portal-cleanup-worker.mjs`.
The embedded DB test uses real pgcrypto but excludes hosted pg_cron/pg_net wiring;
validate those extensions, Vault secrets and Edge execution in staging.
After staging deployment run Supabase security advisors and test multiple concurrent
activation requests with separate real Postgres connections before production.
Confirm: authenticated owner cannot read someone else's private files or payment
claims, cannot set verification/paid flags, cannot bypass RLS via the ranking view,
non-admin cannot approve plans, actual Storage removal happens before metadata clears,
and old live ads remain available until the planned backfill/cutover is complete.

Backfill existing live ads only after a deliberate owner-claim workflow. Never infer
account ownership from an unverified phone or attach scraped public ads to arbitrary
new accounts. UPI/WhatsApp/ID collection must not be silently activated for old users.
