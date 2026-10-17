# MSG91 phone authentication — staged implementation

This branch adds SMS phone sign-in and independent SMS call-number verification. The production frontend and database have not been released with this change.

## Review URLs

- `/dashboard/phone-preview`: interactive SMS sign-in and verification demonstration. Uses no SDK, SMS, Auth request or database write. Any six digits demonstrate confirmation.
- `/dashboard/preview`: existing owner dashboard with the new separate phone-verification control.

## Security model

The browser uses the MSG91 Web SDK and its public widget token, with CAPTCHA configured in MSG91. The account Authkey remains server-only. The server checks `verifyAccessToken` with MSG91, compares the provider-verified number with a server-created challenge, and consumes both the challenge and token fingerprint once. Challenges are bound to an HttpOnly SameSite cookie and, for linking, the authenticated account. Database and widget configuration enforce a 60-second resend interval. Challenges and proof checks also have hourly limits.

A successful phone proof links a unique SMS identity to the account. An existing different WhatsApp login number is preserved. A number belonging to another account is rejected rather than automatically merging accounts. Email verification is never fabricated, and passwords are never reset.

For phone sign-in, Supabase still creates and signs its own native session. A server-only, 30-second exchange captures the Supabase-generated OTP through the signed existing Send SMS hook, encrypts it with AES-256-GCM, and consumes it internally after the MSG91 proof. The Supabase OTP is never returned to the browser or logged, and the bridge does not send an additional WhatsApp OTP. Hook retries acknowledge the existing hand-off without replacing its code. The session's user ID must match the resolved account.

WhatsApp OTP delivery records a fingerprint; the client confirms possession after native Auth verification. SMS verification does not create a WhatsApp verification record. Existing WhatsApp identities remain valid. Only a call number matching the SMS record receives `call_verified`; legacy `phone_verified` continues to mean WhatsApp. Listing calls and WhatsApp can use different numbers. Changing a verified SMS number removes the badge from listings still using the old call number. Applying a new WhatsApp number updates only WhatsApp contacts.

## Configuration

Production and Preview have MSG91 widget ID, widget token and server Authkey. Do not expose the server Authkey under a NEXT_PUBLIC name. Default widget sender/template eligibility and billing remain controlled by MSG91.

The production Supabase service-role key remains Production-only. Automatic approval rejected expanding its scope to Preview because it gives preview code privileged access to the live database. No workaround has been used. An actual OTP preview needs an explicitly approved backend environment; prefer an isolated test Supabase project with its own Auth hook and server key, or an explicitly approved production-backed test. Never add a privileged key to Preview without that decision.

## Release sequence — pending

1. Review this branch and run the test commands below.
2. Choose an approved backend test environment. Configure the public Supabase URL/key and its private service key directly in Vercel; never put them in chat, source files or logs.
3. Apply `supabase/rollout/msg91_phone_auth.sql` via Supabase migrations, then commit the exact generated migration version returned by Supabase. The SQL has been tested locally and has NOT been applied to production.
4. Deploy the signed Send SMS hook for that environment before enabling phone sign-in. Supabase must invoke the same backend/database used by the phone API. A Preview API cannot use an old production hook that lacks the exchange logic.
5. Test real SMS delivery, provider Authkey permissions/response, native Auth session, sign-out/sign-in, linking an existing account, distinct WhatsApp number, phone change, posting, badge matching and 60-second resend.
6. Release the tested backend and frontend together. Do not expose an SMS button before the database and hook are ready.

Tests:

```
node tests/msg91-phone-db.mjs
node tests/msg91-phone-routes.mjs
node tests/whatsapp-auth-hook.mjs
node tests/owner-dashboard-ui.mjs
npm run lint -- --quiet
npm run build -- --webpack
```

Automated tests cover database ownership/RLS, collisions, challenge actor/cookie/destination binding, token reuse, separate badges, encrypted hand-off, signed webhook, native-session user binding, no second WhatsApp send, linking without replacing a session, and invalidating a call badge after a phone change. They do not prove real MSG91 SMS delivery or production provider permissions. Those require the user to enter the SMS received on their own device.
