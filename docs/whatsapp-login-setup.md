# WhatsApp registration and login

Supabase Auth generates and verifies phone OTPs. Its signed Send SMS hook delivers them through the replaceable Evolution adapter in `src/lib/server/whatsapp-delivery.ts`. Although Supabase calls the channel `sms`, this hook sends WhatsApp messages only. Do not configure an SMS fallback without revisiting the WhatsApp badge semantics.

Email and Google continue to work. New WhatsApp accounts have no email; they can post, manage and submit ID immediately after OTP verification. Only matching property contact numbers receive the WhatsApp badge. Adding an email does not verify it: the owner must open the confirmation link. Verified email enables renewal reminders. Existing badges persist across sign-in methods.

## Private production configuration

1. In Vercel → ToLet Odisha → Settings → Environment Variables, add **Production** values:
   - `EVOLUTION_API_URL`: `https://whatsapp.toletodisha.in`
   - `EVOLUTION_API_KEY`: your existing Evolution API key from the server. Sensitive, never `NEXT_PUBLIC_`.
   - `EVOLUTION_INSTANCE_NAME`: existing `tolet-odisha` value.
   - `SUPABASE_SMS_HOOK_SECRET`: signing secret from step 2. Sensitive; independent of `EVOLUTION_WEBHOOK_SECRET`.
   - `WHATSAPP_LOGIN_ENABLED`: `true` only when all steps below are ready.
2. Supabase → Authentication → Hooks → Send SMS → HTTP endpoint:
   - URL: `https://www.toletodisha.in/api/auth/whatsapp-hook`
   - Generate a signing secret and copy it directly into Vercel as `SUPABASE_SMS_HOOK_SECRET` (format `v1,whsec_…`). Never paste it into a chat or commit it.
3. Enable the Phone provider and phone sign-ups in Supabase. **Require OTP confirmation; do not enable automatic phone confirmation.** Keep email/Google providers enabled. The Send SMS hook replaces provider delivery; no Twilio/MSG91 credentials are used by this integration. If the dashboard demands an SMS-provider configuration, do not invent credentials: review its current hook/provider setup.
4. Set OTP expiry to 5 minutes, length to 6, resend interval to at least 60 seconds. Keep Auth rate limits and production abuse controls enabled. Application delivery adds 10 requests per destination per hour and 200 globally per hour; adjust deliberately as usage grows.
5. Redeploy after adding environment variables. The UI capability endpoint exposes only readiness booleans, never credentials.
6. The Auth hook payload must include `sms.phone`, the actual OTP destination. The hook deliberately rejects payloads without it rather than guessing from the account phone during a phone change. If your hosted Auth version omits it, stop activation and check current Supabase support/version; do not bypass this check.
7. Test with a separate personal WhatsApp number, not the connected business sender:
   - Sign out, request OTP, enter a wrong/expired code (must fail), then a valid code (must create a session).
   - Post with the same contact number. WhatsApp verified; email not verified. Confirm it appears in the same dashboard after signing out/in.
   - Add an email. Confirm the email stays unverified until its confirmation link is used. Both badges should then remain verified.
   - Send dashboard link: it must arrive only at the verified account number. The link contains no login token and still requires sign-in.
   - Repeat a login and confirm it opens the existing account rather than a duplicate.
   - Verify existing email/Google accounts and administrator access still work.

## Existing accounts

A number already verified against a different account cannot create a separate WhatsApp account. Sign in using that existing account's email/Google, then use Account access → Enable WhatsApp sign-in to attach the phone using OTP. No automatic account merging, reassignment by contact details, or invented email addresses.

## Operational limits

Evolution/Baileys must stay connected. A fresh QR pairing can be required after logout. Keep verified recovery email available, but do not imply email/Google automatically recover an unrelated WhatsApp-only account. Account credentials and OTPs are never logged or stored by the app; Supabase handles OTP expiry, retry limits and session issuance. Auth hooks have a short time budget: delivery is one database check plus a bounded HTTPS request and must acknowledge provider acceptance. A timeout is shown as a delivery failure, never a successful sign-in.

The existing incoming verification webhook remains separate. Moving delivery to Meta requires replacing the adapter and configuring the official sender/template. It does not require moving accounts or listings.
