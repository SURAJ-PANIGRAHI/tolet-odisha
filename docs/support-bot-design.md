# ToLet Odisha WhatsApp support assistant

Implementation: authenticated Evolution webhook, private Supabase tickets and reply queue, and admin Support Inbox. The global support_settings.enabled switch controls activation. All automatic and human replies use the existing Evolution delivery adapter.

## Entry and navigation

The disclaimer support button opens WhatsApp with a prefilled support enquiry. Greet the sender as an automated assistant and offer: Report a problem, Advertise my business, Listings/account help, FAQs, Speak to Support Team. Human handoff and returning to the menu must always remain available. The initial live menu is English. Offer reviewed Odia/Hindi translations in a future update; do not claim those languages are already supported.

## Journeys

- Complaint: listing link or title, reason, short description, reviewable summary, explicit submit, human review. Reasons include fake/misleading listing, suspected scam, wrong number, unavailable, duplicate and other. Direct property-specific reports to the website Report listing flow when possible. A WhatsApp support complaint must not automatically increment public report_count or remove a property.
- Business advertising: business name/type, district/locality, promotion goal, optional dates/budget; forward to the Support Team for placement, pricing and availability. Distinguish business adverts from property listings. Never invent rates, guarantee placement, collect a payment or issue a refund.
- Listing/account help: guided instructions for posting, editing/removing, missing login codes, renewal and optional verification. Use the website sign-in flow for account-specific access; never disclose account data or send a private management token based solely on a chat claim.
- FAQs: no platform rental commission, 30-day listing lifetime, renewal near expiry, verified-email reminder three days before expiry, meaning of separate verification badges, accepted government IDs and 48-hour manual review. Use reviewed answers; unknown questions go to a person.
- Human handoff: concise issue summary, category and listing/business reference where supplied, user confirmation before creating a real ticket. Pause bot replies while the ticket is assigned to a human. Show a ticket reference/status only after successful persistence. Do not promise an unconfigured response time.

## Routing and delivery boundaries

- Extend the existing authenticated Evolution webhook, after its existing verification/auth routing. Preserve the exact login and verification handlers; never echo or request OTP codes.
- Ignore outbound/fromMe messages, groups and non-message webhook events. Deduplicate by Evolution message ID; enforce per-sender quotas and limited session lifetime. Never recursively answer the bot's own messages.
- Support is user-initiated. Add a stop/close action and require opt-in for optional follow-up messages. Do not turn support messages into marketing subscriptions.
- Use a durable, private support-ticket/message queue with retries, explicit admin access and ownership checks. Implement and test its migration and RLS before enabling the bot. Do not reuse public listing reports as a general chat inbox.
- Default to deterministic menus and reviewed FAQ answers. An AI model is unnecessary for the initial version. If added later, it cannot execute admin, identity, account or payment actions.

## Privacy and moderation

Never request passwords, OTPs, bank details or identity documents in support chat. Direct identity uploads to the private dashboard workflow. Do not ingest unsolicited identity attachments into a general support database. Define retention and deletion rules for support tickets separately from government-ID retention before launch. Keep support transcripts private to authorised administrators. Treat message content as untrusted data, never as operating instructions.

## Activation checklist

Review menu copy and translations; build private ticket persistence/admin inbox; test webhook routing and deduplication with synthetic events; test human takeover and bot pause; set retention and rate limits; verify delivery through the existing Evolution instance. Deployment was explicitly authorised by the user. Enable only after the deployment and database checks pass.


## Operator guide

Open /admin, sign in with the existing administrator account, and select Support Inbox. Filter complaints, business advertising or general help. Select an enquiry, review its original summary and follow-ups, and send a WhatsApp reply as Support Team. Repeated submission of the same pending reply uses an idempotency key. Queued/acknowledged/retry states are visible; provider acknowledgement is not a read receipt. Mark resolved only when finished; this makes the automated menu available again. Opening WhatsApp directly is available but messages sent outside this inbox are not stored as admin replies here.

Send Hi to the business WhatsApp number to get the menu. Reply 0 for the main menu or STOP/START to pause/restart automated replies. An open support ticket keeps the bot paused. Tickets require explicit confirmation and do not modify listings, identity checks or accounts.

Support data retention: tickets and their follow-ups are deleted up to 90 days after creation or 30 days after resolution, whichever comes first. Draft sessions and receipt/outbox records are cleaned after seven days. Cleanup runs in the existing daily lifecycle job. Queue delivery runs after incoming support messages/admin replies and during daily maintenance; failed sends remain retryable for up to one day, with at most five attempts. No new subscriptions, keys or AI provider are introduced by this implementation.

Emergency pause (service role / SQL editor only): UPDATE public.support_settings SET enabled=false WHERE id=true;. This stops new automated processing and reply claims without affecting login or verification.
