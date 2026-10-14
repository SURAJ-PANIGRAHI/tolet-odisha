# Evolution WhatsApp verification

This integration is implemented for the additive `portal_profiles` schema, not the legacy anonymous listings system. It is not activated on production. Applying these migrations does not automatically connect existing anonymous listings to signed-in accounts or add badges to their listing cards.

## What the QR code does

Evolution's WhatsApp Web/Baileys connector pairs **your business WhatsApp account** with a continuously running Evolution server by scanning its connection QR code. Each advertiser does not pair an account with the server: they sign in, enter their own number, open a wa.me link to your connected business number, and **send** the prefilled message. Your incoming webhook confirms the exact sender against their pending challenge. No outgoing OTP message is required.

This connector avoids official WhatsApp per-message API billing for this inbound flow, but server hosting and operations still have costs. It relies on a WhatsApp Web session, may disconnect, and is not a guarantee of Meta approval or uninterrupted service. Evolution also supports the official WhatsApp Business Platform, which has a different setup and billing model. Choose and pin a tested Evolution release; do not deploy an unpinned latest image.

## Files and database contract

- `src/app/dashboard/page.tsx`: email magic-link sign-in and verified-account dashboard.
- `src/components/WhatsAppVerification.tsx`: challenge creation, WhatsApp link, bounded polling and verified state.
- `src/app/api/verification/whatsapp/route.ts`: authenticated challenge POST and own-account status GET.
- `src/app/api/webhooks/whatsapp/route.ts`: authenticated Evolution incoming-message handler.
- `src/lib/server/evolution.ts`: bounded JSON parser, message extraction and phone normalization.
- `src/lib/server/portal-auth.ts`: validates access tokens using Supabase Auth `getUser`.
- `supabase/migrations/20261013202535_evolution_phone_verification.sql`: atomic service-only verification RPC, status RPC and receipt retention.

Apply `20261013190355_portal_verification_and_monetization.sql` first, following `docs/portal-v2-setup.md`, including its hosted integration configuration. Then apply the Evolution migration. Test on a staging project before migrating production. The verified flag is `portal_profiles.is_phone_verified`; the number is `portal_private.contacts.phone_e164`, with a unique verified-number constraint. It is intentionally not exposed in publicly readable profiles.

Authenticated routes obtain the actor from a validated access token. Clients cannot write verification flags, choose another user's UUID, or call the service-only RPCs directly. Never expose the service-role key to the browser.

## 1. Configure Supabase Auth

Enable email magic-link sign-in and allow the exact deployment `/dashboard` URL in Supabase Auth redirect URLs. Existing v2 signup triggers create the profile and private contact row. Configure an email provider and its delivery limits for real usage. This dashboard uses the project's browser Supabase client and magic-link callback handling; do not change it to a PKCE flow without adding a code-exchange callback.

## 2. Host and connect Evolution

Follow your selected release's official installation guide. Run Evolution on infrastructure that supports its persistent session, database and Redis requirements; the Next.js Vercel webhook function is not the Evolution server. Protect the management API with its API key, restrict network access, use HTTPS and protect session credentials/backups. Disable or minimize raw webhook/message logging, including nonce and phone data.

Create an instance for the WhatsApp Web connector, connect the business number using the manager's QR code, and confirm it receives messages from a separate test phone. Advertisers must message this number, not themselves.

## 3. Set application environment variables

Use the Vercel/server environment settings; never paste secrets into chat or commit them.

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVER_ONLY_SERVICE_KEY
WHATSAPP_BUSINESS_NUMBER=917428975781
EVOLUTION_INSTANCE_NAME=tolet-odisha
EVOLUTION_WEBHOOK_SECRET=YOUR_RANDOM_SECRET_AT_LEAST_32_CHARACTERS
```

`WHATSAPP_BUSINESS_NUMBER` must contain country code 91 and a valid Indian mobile number, digits only. Generate a random secret, for example `openssl rand -hex 32`. Instance names must match the Evolution webhook envelope exactly. Redeploy after setting environment variables.

## 4. Configure the instance webhook

Use the instance's webhook settings, or your release's `/webhook/set/{instance}` endpoint. Current upstream code uses a `webhook` wrapper with this shape; verify your installed release's API schema before submitting:

```json
{
  "webhook": {
    "enabled": true,
    "url": "https://www.toletodisha.in/api/webhooks/whatsapp",
    "headers": {
      "x-evolution-webhook-secret": "THE_SAME_RANDOM_SECRET"
    },
    "events": ["MESSAGES_UPSERT"],
    "byEvents": false,
    "base64": false
  }
}
```

Authenticate this configuration request with the Evolution management API key. That API key is separate from the webhook secret. `byEvents` must be false so Evolution does not append the event name to the URL. Earlier versions use different field names such as `webhook_by_events`: follow the installed version's schema. Verify that the **custom header is actually delivered**; a release that cannot send it is not compatible with this handler as written. Do not remove authentication or put secrets in the URL to bypass a 401.

The code accepts an instance envelope with `messages.upsert` or `MESSAGES_UPSERT`, and a `data` object or array. Sender identity comes from the incoming message key. The envelope's `sender` field represents the connected business account and is deliberately ignored. WhatsApp privacy LIDs need a provider-supplied phone-number JID, such as `remoteJidAlt` or `senderPn`; an unresolved LID is ignored rather than guessed. Check this against the actual payload from your installed release using redacted test data.

The shared secret authenticates the HTTPS webhook transport; it is not a per-payload cryptographic signature. Restrict network access to the Evolution host where possible and keep that host trusted. Configure/test webhook redelivery for HTTP 503 on your installed version; don't assume automatic retries are available.

## 5. End-to-end acceptance test

1. Sign in at `/dashboard` using a confirmed email.
2. Enter the same Indian mobile number that will send the WhatsApp message.
3. Click **Verify Phone via WhatsApp**, then **Open WhatsApp and send the message**.
4. Send the message without editing it. Opening the app or scanning the business connection QR alone does not verify an advertiser.
5. Return to the dashboard. It polls every three seconds while the challenge is pending and stops on success, expiry or failure. On a temporary error, choose **Check status again**.
6. Check the service-only RPC changed the profile flag and private verified contact timestamp. The dashboard displays **Phone Verified ✅**.
7. Test a different sender, an expired link, an old superseded link, duplicate delivery, group messages, outgoing messages and missing webhook secret. None may verify a new account.
8. Disconnect the Evolution session and confirm the dashboard never claims success without an actual accepted inbound message; reconnect and retry with a fresh challenge.

The verification text is `VERIFY_<USER_UUID>_<RANDOM_NONCE>`, not a bare UUID. The nonce is generated on the server, hashed in the database, single-use, sender-bound and expires after 30 minutes. Each account can create at most five challenges per hour. Changing the number revokes its verified flag until the new number is confirmed. Verified numbers cannot be reassigned to another account through this flow. Webhook receipts provide idempotency and are pruned after 30 days. No raw messages or plaintext challenge codes are stored by this application.

## Verification performed locally

`npm run test:whatsapp` tests payload parsing, webhook authentication, database errors/retry status, JWT-bound challenge/status routes, actor spoof rejection, PostgreSQL challenge matching, expiry, replay, number uniqueness and service-only permissions. `npm run test:portal` checks the broader v2 schema and cleanup worker. Build/type/lint checks do not establish real WhatsApp session connectivity or webhook delivery: that requires the acceptance test with the configured Evolution server.

## Primary references

- https://github.com/evolution-foundation/evolution-api
- https://github.com/evolution-foundation/evolution-api/blob/main/src/api/integrations/event/webhook/webhook.controller.ts
- https://github.com/evolution-foundation/docs-evolution/blob/main/v2/en/configuration/webhooks.mdx
