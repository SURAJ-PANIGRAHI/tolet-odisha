# Phone verification retired

The site owner chose optional email verification instead of phone OTP on 2026-10-12. Phone routes and frontend verification controls are removed. No SMS provider is required. The previous phone function/columns remain unused historical database objects; no current application endpoint calls them.

New listings publish immediately through submit_managed_listing, retaining the private owner-removal link. Email stays optional. email_verified defaults to false and is set only by signed owner email confirmation/renewal; verified existing contacts were backfilled. The email address remains in the private contact table. Public listings expose only the verification boolean. Browser inserts are revoked and authenticated administrators can update only moderation status and activity.

Admin moderation is used for reported listings. Thirty-day expiry and reminders within the final three days for verified emails remain active. The Email verified badge does not verify a phone number, identity or property ownership.
