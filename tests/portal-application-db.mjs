import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { readFileSync, readdirSync } from "node:fs";
import assert from "node:assert/strict";
process.on("uncaughtException", (e) => {
  console.error(e.message, e.where || "");
  process.exit(1);
});
const db = new PGlite({ extensions: { pgcrypto } });
const existing = readFileSync(
  new URL("./portal-v2-db.mjs", import.meta.url),
  "utf8",
);
const bootstrap = existing.split("await db.exec(`")[1].split("`);")[0];
await db.exec(bootstrap);
await db.exec("alter table auth.users add column email text");
const dir = new URL("../supabase/migrations/", import.meta.url);
for (const suffix of [
  "_portal_verification_and_monetization.sql",
  "_evolution_phone_verification.sql",
  "_portal_application_flows.sql",
]) {
  const name = readdirSync(dir).find((f) => f.endsWith(suffix));
  const sql = readFileSync(new URL(name, dir), "utf8")
    .split("-- BEGIN HOSTED INTEGRATIONS")[0]
    .split("-- Apply only")[0];
  await db.exec(sql);
}
const ids = Array.from(
  { length: 5 },
  (_, i) => `00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
);
for (let i = 0; i < ids.length; i++)
  await db.query(
    "insert into auth.users(id,email,email_confirmed_at,is_anonymous,raw_user_meta_data) values($1,$2,case when $3 then now() else null end,$4,jsonb_build_object('full_name','Test Owner'))",
    [ids[i], i === 0 ? null : `test${i}@example.test`, i !== 0, i === 0],
  );
await db.query("insert into portal_private.admins(user_id) values($1)", [
  ids[3],
]);
async function role(name) {
  await db.exec("reset role;set role " + name);
}
const q = async (s, args = []) => (await db.query(s, args)).rows;
await role("service_role");
const row = {
  title: "Test property",
  description: "Test",
  category: "2 BHK Flat",
  commercial_type: null,
  advertiser_type: "Owner",
  area_sqft: null,
  rent_monthly: 8000,
  deposit: 0,
  district: "Balasore",
  locality: "Remuna",
  contact_name: "Test Owner",
  contact_phone: "9876543210",
  images: [],
  amenities: [],
};
const hash = "a".repeat(64),
  hash2 = "b".repeat(64);
const first = (
  await q("select portal_post_listing($1,$2,$3) id", [
    ids[0],
    JSON.stringify(row),
    hash,
  ])
)[0].id;
assert.equal(
  (
    await q("select is_email_verified from portal_profiles where user_id=$1", [
      ids[0],
    ])
  )[0].is_email_verified,
  false,
);
assert.equal(
  (await q("select portal_management_actor($1,$2) actor", [first, hash]))[0]
    .actor,
  ids[0],
);
assert.equal(
  (await q("select portal_management_actor($1,$2) actor", [first, hash2]))[0]
    .actor,
  null,
);
await assert.rejects(
  q("select portal_post_listing($1,$2,$3)", [
    ids[0],
    JSON.stringify(row),
    hash2,
  ]),
  /MULTI_LISTING_PACK_REQUIRED/,
);
const expired = (
  await q("select expires_at from portal_listings where id=$1", [first])
)[0].expires_at;
await q("select portal_edit_listing($1,$2,$3)", [
  ids[0],
  first,
  JSON.stringify({ ...row, title: "Updated property" }),
]);
assert.equal(
  (
    await q("select expires_at from portal_listings where id=$1", [first])
  )[0].expires_at.getTime(),
  expired.getTime(),
);
await assert.rejects(
  q("select portal_claim_listing($1,$2,$3)", [ids[0], first, hash]),
  /Sign in/,
);
await q("select portal_claim_listing($1,$2,$3)", [ids[1], first, hash]);
assert.equal(
  (await q("select user_id from portal_listings where id=$1", [first]))[0]
    .user_id,
  ids[1],
);
assert.equal(
  (await q("select portal_management_actor($1,$2) actor", [first, hash]))[0]
    .actor,
  null,
);
await assert.rejects(
  q("select portal_remove_listing($1,$2)", [ids[0], first]),
  /not found/,
);
await assert.rejects(
  q("update portal_listings set user_id=$1 where id=$2", [ids[2], first]),
  /Owner cannot change/,
);
const phone = (
  await q("select * from portal_create_phone_challenge($1,$2)", [
    ids[0],
    "+919876543210",
  ])
)[0];
assert.equal(
  (
    await q(
      "select portal_accept_whatsapp_verification($1,$2,$3,$4,$5) result",
      [
        ids[0],
        phone.verification_text.split("_")[2],
        "+919876543210",
        "tolet",
        "message",
      ],
    )
  )[0].result,
  "verified",
);
const second = (
  await q("select portal_post_listing($1,$2,$3) id", [
    ids[0],
    JSON.stringify(row),
    hash2,
  ])
)[0].id;
let feed = (await q("select portal_public_feed() feed"))[0].feed;
assert.equal(feed.find((l) => l.id === second).phone_verified, true);
assert.equal(feed.find((l) => l.id === second).email_verified, false);
await q("select portal_edit_listing($1,$2,$3)", [
  ids[0],
  second,
  JSON.stringify({ ...row, contact_phone: "9876543211" }),
]);
feed = (await q("select portal_public_feed() feed"))[0].feed;
assert.equal(feed.find((l) => l.id === second).phone_verified, false);
const path = ids[1] + "/passport.jpg";
await q("select portal_prepare_id_upload($1,$2)", [ids[1], path]);
await q(
  "insert into storage.objects(bucket_id,name) values('portal-government-ids',$1)",
  [path],
);
const doc = (
  await q(
    "select portal_register_id_upload($1,'passport',$2,'portal-id-v1') id",
    [ids[1], path],
  )
)[0].id;
assert.equal(
  (
    await q("select * from portal_private.cleanup_jobs where object_path=$1", [
      path,
    ])
  ).length,
  0,
);
await q("select portal_review_id($1,$2,true)", [ids[3], doc]);
await assert.rejects(
  q("select portal_register_id_upload($1,'pan_card',$2,'v1')", [
    ids[2],
    ids[2] + "/no-file.jpg",
  ]),
);
await q('update portal_profiles set display_name=$1 where user_id=$2',['Updated Owner Name',ids[1]]);
assert.equal((await q('select is_id_verified from portal_profiles where user_id=$1',[ids[1]]))[0].is_id_verified,false);
assert.equal((await q('select status from portal_private.id_documents where id=$1',[doc]))[0].status,'rejected');

// Orphan upload deletion is allowed even if this account still has an active listing.
const orphan = ids[1] + "/orphan.jpg";
await q("select portal_prepare_id_upload($1,$2)", [ids[1], orphan]);
await q(
  "update portal_private.cleanup_jobs set due_at=now()-interval '1 minute' where object_path=$1",
  [orphan],
);
const jobs = await q("select * from portal_claim_id_cleanup(20)");
assert(jobs.some((j) => j.object_path === orphan));
const orphanJob = jobs.find((j) => j.object_path === orphan);
await q("select portal_finish_id_cleanup($1,$2,true)", [
  orphanJob.id,
  orphanJob.claim_token,
]);
for (const job of jobs.filter(j=>j.id!==orphanJob.id)) {
 await q('delete from storage.objects where name=$1',[job.object_path]);
 await q('select portal_finish_id_cleanup($1,$2,true)',[job.id,job.claim_token]);
}

// Reminder queues are recipient-verified, one per expiry cycle and leased before sending.
await q(
  "update portal_listings set expires_at=now()+interval '2 days' where id=$1",
  [first],
);
await q("select portal_daily_maintenance()");
await q("select portal_daily_maintenance()");
assert.equal(
  (await q("select * from portal_private.email_jobs where kind='reminder'"))
    .length,
  1,
);
let emailJobs = await q("select * from portal_claim_emails(5)");
assert.equal(emailJobs.length, 1);
assert.equal(emailJobs[0].recipient, "test1@example.test");
assert.equal((await q("select * from portal_claim_emails(5)")).length, 0);
await q("select portal_finish_email($1,$2,true)", [
  emailJobs[0].id,
  emailJobs[0].claim_token,
]);
// Reports enqueue two admin destinations; repeated reports don't duplicate notifications.
await q("select portal_report_listing($1,$2,'Wrong contact number','Test')", [
  ids[2],
  first,
]);
await q("select portal_report_listing($1,$2,'Wrong contact number','Test')", [
  ids[2],
  first,
]);
assert.equal(
  (await q("select * from portal_private.email_jobs where kind='report'"))
    .length,
  2,
);
await role("authenticated");
await assert.rejects(q("select portal_public_feed()"), /permission denied/);
await assert.rejects(
  q("select * from portal_private.management_keys"),
  /permission denied/,
);
await assert.rejects(
  q("select * from portal_private.email_jobs"),
  /permission denied/,
);
await db.close();
console.log(
  "PASS application DB: unverified guest posting, cap, key ownership/claim, edit expiry, independent WhatsApp, private passport/orphans, verified reminders, dual-recipient reports, leases and RLS",
);
