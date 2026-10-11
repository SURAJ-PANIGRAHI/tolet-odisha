# Staged production rollout

The database received backend.sql as migration staged_reports_lifecycle_backend on 2026-10-11 UTC. It preserves legacy listing INSERT permissions/defaults/policies until cutover. Do not apply the original three migrations again to this database. They remain the fresh-database test fixtures.

Before switching production: create and allowlist the administrator Supabase Auth account; verify server-only Production credentials; build the release; coordinate cutover.sql with production activation. After cutover, verify browser report submission, saved report, Resend delivery, listing submission/owner confirmation, administrator approval, and the authenticated cron. Existing owners have no verified contact emails and cannot receive renewal reminders yet.

The staged backend passed tests/rollout-db.mjs. A production database report/notification atomicity check passed inside a rolled-back transaction, leaving no test report or email job. The default-branch merge was blocked by automatic approval review because deployment prerequisites were incomplete. No production deployment or real notification email has been performed.
