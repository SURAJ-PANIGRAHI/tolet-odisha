# Phone-verified posting rollout

The OTP integration is gated by NEXT_PUBLIC_PHONE_OTP_ENABLED=true. Its default is false, preserving existing pending/review posting until SMS is configured. Never enable it without a real SMS delivery/verification test. The disclaimer and three-day reminder migrations can be deployed independently.

## Provider setup

Open Supabase Authentication > Sign In / Providers > Phone. Connect a supported SMS provider (Twilio/Twilio Verify, MessageBird, Vonage, or the provider offered in the dashboard). Provider account and sending charges require the owner to arrange billing. Store provider credentials only in Supabase settings, never the public browser bundle or Git. Enable Phone sign-in, require confirmation, and use a six-digit OTP with a short expiry and resend limits. For Indian delivery, follow the chosen provider's current sender/template/DLT requirements. Supabase also recommends CAPTCHA and SMS rate limits to control abuse; enabling CAPTCHA additionally requires a frontend challenge before signInWithOtp. This implementation does not yet include that challenge.

Apply phone_verified_posting.sql after owner_removal.sql, and three_day_reminders.sql after automated_lifecycle. These are service-role-only functions. The posting route validates a Supabase Auth access token with getUser and matches the confirmed phone to the contact number; browser verified flags are never trusted. The verified user is stored only in a private management table.

Set NEXT_PUBLIC_PHONE_OTP_ENABLED=true for the intended Vercel environment and rebuild. First test in a controlled deployment with appropriate credentials: actual OTP delivery; incorrect/expired OTP rejection; matching phone publication; altered phone rejection; optional email; verified email-only reminders; owner removal; report moderation. No real SMS verification has been performed while the provider is unconfigured.

The application caps its SMS endpoint at three requests per phone per hour and thirty requests globally per hour; provider/Supabase protections also apply, including to direct Auth requests. Access tokens stay in memory and are not stored in the shared admin/browser client.

## Lifecycle and disclaimer

Listings expire thirty days after submission. The daily lifecycle job queues one reminder during the last three days for verified email contacts; without a verified email, no reminder is queued. A daily schedule may deliver within the three-day window rather than at an exact 72-hour timestamp. The existing pilot dispatcher processes up to five retry/reminder jobs daily; higher volumes need a larger dispatch schedule/capacity. Explicit renewal is available during that same three-day window.

The disclaimer identifies Anx Platforms and its Irish registration as supplied by the site owner. No registration number or legal entity suffix has been invented. Liability wording preserves statutory rights and liability that cannot legally be excluded. OTP confirms phone possession, not property ownership or listing accuracy.
