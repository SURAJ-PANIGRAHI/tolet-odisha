# ToLet Odisha: application flows and preview setup

## See the concept preview without running a server

Download `docs/portal-flow-preview.html` and open the downloaded file in Chrome or Edge. Restarting a laptop does not delete the file. This concept preview demonstrates flows; it does not authenticate, upload documents, publish properties or take payments.

## Implementation status

The source now includes guest posting, email magic-link/Google sign-in, account dashboard, private management links, editing/photos/removal/free renewal, attaching a guest property to a signed-in account, independent verification labels, private ID upload and admin review, UPI checkout/manual approval, account capacity enforcement, featured ranking, moderation/report emails, expiry/reminders and physical ID cleanup. These are staging-first changes. Production has not been migrated or deployed with this application flow.

The new flow is gated by `NEXT_PUBLIC_PORTAL_V2_ENABLED=true` during the build. Leave it unset/false on the live deployment until staging is configured and reviewed. Existing anonymous listings remain in the legacy system and are displayed alongside v2 properties when the new flow is enabled. Legacy management links continue to support the existing remove action; old listings do not acquire new ownership or verification automatically.

## Windows localhost preview

1. Extract the source ZIP into a **new folder**, rather than replacing the existing working project. Open that folder in VS Code, choose Terminal → New Terminal. PowerShell is fine.
2. Run `npm ci` to install the locked dependencies.
3. Copy your existing public Supabase URL and anon key into `.env.local` in this folder. For a functional preview, use a dedicated staging Supabase project with all migrations below applied. Put its server service-role key in `.env.local` too; do not send or commit secrets.
4. Add the flags/settings below. Start with live UPI payments disabled.
5. Run `npm run dev -- --port 3001` and leave the terminal open.
6. Open `http://localhost:3001`, `http://localhost:3001/dashboard`, and `http://localhost:3001/advertise` on that same laptop.
7. After a restart, repeat step 5; a local server does not restart automatically. A server running in the assistant's workspace is not your laptop's localhost.

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_STAGING_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_PUBLIC_STAGING_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVER_ONLY_STAGING_SERVICE_KEY
NEXT_PUBLIC_PORTAL_V2_ENABLED=true
UPI_COLLECTIONS_ENABLED=false
WHATSAPP_BUSINESS_NUMBER=917428975781
EVOLUTION_INSTANCE_NAME=tolet-odisha
EVOLUTION_WEBHOOK_SECRET=YOUR_RANDOM_32_PLUS_CHARACTER_SECRET
APP_URL=http://localhost:3001
RESEND_API_KEY=YOUR_SERVER_ONLY_KEY
EMAIL_FROM=YOUR_VERIFIED_SENDING_ADDRESS
CRON_SECRET=YOUR_RANDOM_CRON_SECRET
```

Never use production payment or email credentials in a test environment that can unintentionally notify customers. Environment configuration is required; the ZIP contains no private keys. The localhost preview needs a valid public Supabase URL/key even for rendering the browser client. Missing services produce an explicit unavailable/error state rather than simulated verification or payment approval.

## Staging database

Apply the existing legacy migrations first, then these additive migrations in order:

1. `20261013190355_portal_verification_and_monetization.sql`
2. `20261013202535_evolution_phone_verification.sql`
3. `20261014034235_portal_application_flows.sql`

See `portal-v2-setup.md` for the private Storage bucket, cleanup Edge Function, Vault secrets and pg_cron configuration. See `evolution-whatsapp-setup.md` for the provider connection and webhook. The application migration supersedes the original v2 restriction requiring verified email before posting and adds passport to the accepted IDs. Auth email truth is synced into private contact records by a protected trigger; application service-role queries do not require reads of `auth.users`.

Enable Anonymous Sign-ins for staging in Supabase Auth. Review the project's authenticated-role policies first: anonymous sessions use the authenticated role, but this application's protected writes remain server-only. Anonymous guest sessions create a technical identity without asking the visitor for credentials. They can post with all verification flags false and manage with a high-entropy link. Clearing browser storage loses that guest session; the saved management link still controls the property.

Enable manual identity linking for a guest to add email or Google. Email linking uses `auth.updateUser` followed by actual email confirmation. Google linking uses `auth.linkIdentity`; normal social sign-in uses `auth.signInWithOAuth`. Configure Google OAuth and redirect allowlists for the exact staging/localhost dashboard URLs. Configure custom SMTP for Supabase Auth (your existing Resend setup can be used); Resend API settings for reports/reminders do not automatically configure Auth SMTP.

If an email is already attached to another account, keep the guest management link, sign in to that existing account, and use **Attach a guest listing**. The service verifies the key, locks account rows, enforces the active listing cap, transfers that property, and invalidates the key. Verification flags and private government IDs are not transferred. Auth linking carries the same identity/profile when no identity conflict exists.

Existing admin users are copied from the legacy `public.admin_users` table to private v2 membership during migration. New staff must be provisioned explicitly in `portal_private.admins`. Use the authorised email account to sign in through `/dashboard`; the new review page is `/dashboard/admin`. Existing `/admin` continues to serve legacy data with its separate login client.

## Payments

UPI payee: **Suraj Panigrahi**; VPA: **7428975781@idfcfirst**. Decoded and checked fixed ₹29/₹49 QR images supplied by the user are in `public/payments`. Mobile intent links include the exact amount and payment-request ID. Fixed QR images do not carry unique order references: each payment is reconciled using the claimed UTR and actual bank credit.

`UPI_COLLECTIONS_ENABLED=false` prevents checkout creation. Enable real collections only after the bank confirms this business collection arrangement and staging review is complete. No bank API, automatic payment confirmation, payment gateway or recurring debit mandate is configured. The 30-day pack requires a new payment/approval when it expires; there is no automatic charge.

For paid features, users sign in with email or Google so purchases are attached to a recoverable account. Guest posting remains free. A second active listing requires the approved ₹49 pack. The limit is per account, not a reliable identification of every person or broker; someone can create additional accounts. Advertiser type is a mandatory self-declaration and is not inferred from counts.

Admin approval requires the bank-observed UTR, exact credited amount, bank credit time and explicit review. A bank receipt can approve one request only. ₹29 boosts and ₹49 packs last 30 days from approval, with stacking for a repeat approved purchase. Submitted UTRs, screenshots, return-from-app events and paid checkout alone never issue verification badges.

## Privacy, trust and moderation

Public listing badges independently show email/WhatsApp/ID verified or not verified. Copy: **Verification builds trust.** Ranking favours verification, and a paid boost contributes 1,000 points. The WhatsApp badge is displayed on a property only if its advertised phone matches the verified account contact. Other sort choices retain boosted priority; filters still exclude non-matching properties. Verified contact control/ID review do not establish property ownership or guarantee a scam-free transaction.

Only passport, masked Aadhaar, driving licence and voter ID images are accepted for review. Uploads are JPEG/PNG/WebP under 3 MB with MIME/signature checks and explicit consent. No public bucket, browser read access or owner document download is exposed. Admin links last 60 seconds and are returned only after server-validated staff membership; private images are not sent through Next.js image optimisation.

Each upload has a private cleanup ticket before Storage upload, so failed/uncertain registrations can be reconciled and orphan files deleted. Accepted/rejected records are reviewed manually. Changing the account name revokes the ID badge and queues the old document for deletion before resubmission. Rejected files queue immediate deletion; approved/pending files get the account-level seven-day inactivity grace. Claiming a property also starts a grace clock for the former account. Cleanup completion is acknowledged only after the Storage API removes the physical object. This is active-storage deletion, not a promise of cryptographic erasure or immediate backup destruction.

Daily maintenance expires ads, expires excess listings when a pack lapses, queues reminders within three days of expiry for current verified email addresses, and queues ID deletion. Report submissions queue separate emails to support@toletodisha.in and surajpanigrahi.95@gmail.com. An after-response dispatcher attempts immediate delivery; durable jobs retry in the scheduled dispatcher. Real sender/domain configuration and scheduler activation are prerequisites. Two distinct account reports quarantine a property; guest-account duplication remains an abuse risk requiring monitoring.

Business advertising enquiries stay separate at `/advertise`: WhatsApp **+91 74289 75781** or **support@toletodisha.in**, handled personally.

## Validation and remaining external checks

Run `npm test`, `npm run test:portal`, `npm run test:whatsapp`, `npm run test:application`, `npm run lint`, and `npm run build -- --webpack`. Meaningful PostgreSQL tests cover guest cap, management keys/claims, payment receipt reuse, ranking, independent phone verification, ID privacy/orphans, expiry/reminders, email leases, report deduplication and permissions. Route tests cover CSRF, trusted session identity, editable field whitelists, strict ID types and payment gates. Email tests use stubs and send no real messages.

A successful build does not establish real Google login, SMTP delivery, Evolution connectivity, bank credit, hosted cron execution or browser interaction. Those require an end-to-end staging acceptance test with the external configuration above. No production migration, paid subscription or payment was performed while preparing this code.


## Dashboard and posting review (14 October)

- The current preview still uses the existing listings API unless portal v2 is enabled. New submissions now open `/listing-posted` with a private management credential in the URL fragment and save the link in this browser.
- `/dashboard` shows browser-saved properties before sign-in. Earlier guest listings can be restored using their private management links; a phone number or email address alone never grants ownership. Saved cards are bookmarks, not authoritative availability records.
- Storage is scoped to the website origin. Use the stable branch preview URL consistently. To move between preview URLs, production, or devices, copy your private management link and import it on the destination dashboard. Clearing browser data removes local bookmarks. Existing guest management currently supports removal; the full edit/renew/account dashboard requires the portal setup above.
- The Google button checks Supabase's public Auth settings and is disabled with an explanation when the provider is unavailable. Google was disabled and email enabled during this review. Enabling Google still requires the Google OAuth client and allowed callback/redirect URLs in Supabase. An icon alone does not configure OAuth.
- Verified Profile sorting uses ID 200, WhatsApp 100 and email 50 points; paid Featured placement remains first when portal ranking is enabled. Ties use newest first.
- `npm run test:preview` verifies the actual form submit handler with mocked network calls, failed submissions, management-link persistence, storage failure, verification sorting, and rendered UI/contact intents. Local Chromium crashed before launch; this is not a completed live browser/auth/payment test.
