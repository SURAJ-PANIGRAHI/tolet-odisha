import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import assert from "node:assert/strict";
import ts from "typescript";
const require = createRequire(import.meta.url);
function load(path, mocks = {}) {
  const code = ts.transpileModule(
    readFileSync(new URL("../" + path, import.meta.url), "utf8"),
    {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.CommonJS,
      },
    },
  ).outputText;
  const mod = { exports: {} };
  new Function("require", "module", "exports", code)(
    (name) => (Object.hasOwn(mocks, name) ? mocks[name] : require(name)),
    mod,
    mod.exports,
  );
  return mod.exports;
}
const utils = load("src/lib/server/evolution.ts");
const id = "550e8400-e29b-41d4-a716-446655440000",
  other = "550e8400-e29b-41d4-a716-446655440001";
let guest = false,
  admin = false,
  queries = [],
  keyActor = null,
  rate = true;
const db = {
  rpc: async (name, args) => {
    queries.push({ name, args });
    if (name === "portal_management_actor")
      return { data: keyActor, error: null };
    if (name === "portal_account_admin") return { data: admin, error: null };
    if (name === "portal_public_feed") return { data: [], error: null };
    if (name === "portal_create_payment" || name === "portal_post_listing")
      return { data: id, error: null };
    return { data: null, error: null };
  },
  from: () => {
    const builder = {
      select: () => builder,
      eq: () => builder,
      gt: () => builder,
      single: async () => ({ data: { id }, error: null }),
    };
    return builder;
  },
};
const auth = {
  portalUser: async (request) =>
    request.headers.get("authorization") === "Bearer good"
      ? {
          user: {
            id,
            is_anonymous: guest,
            email_confirmed_at: guest ? null : "2026-01-01",
          },
          db,
        }
      : null,
};
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
process.env.NEXT_PUBLIC_PORTAL_V2_ENABLED = "true";
const listingValidator = load("src/lib/server/portal-listing.ts", {
  "@/data/odisha": load("src/data/odisha.ts"),
  "./evolution": utils,
});
const route = load("src/app/api/portal/route.ts", {
  "next/server": { after: () => {} },
  "@/lib/server/portal-email": { dispatchPortalEmails: async () => {} },
  "@/lib/server/portal-auth": auth,
  "@/lib/server/lifecycle": {
    serverDb: () => db,
    consumeQuota: async () => rate,
  },
  "@/lib/server/evolution": utils,
  "@/lib/server/portal-listing": listingValidator,
});
const row = {
  title: "Test room",
  category: "2 BHK Flat",
  advertiser_type: "Owner",
  rent_monthly: 8000,
  deposit: 0,
  district: "Balasore",
  locality: "Remuna",
  contact_name: "Owner",
  contact_phone: "9876543210",
  images: [],
  amenities: [],
  area_sqft: null,
  commercial_type: null,
};
const req = (data, token = "good", origin = "https://tolet.test") =>
  new Request("https://tolet.test/api/portal", {
    method: "POST",
    headers: {
      origin,
      "content-type": "application/json",
      ...(token ? { authorization: "Bearer " + token } : {}),
    },
    body: JSON.stringify(data),
  });
assert.equal(
  (await route.POST(req({ action: "create", listing: row }, null))).status,
  401,
);
assert.equal(
  (
    await route.POST(
      req({ action: "create", listing: row }, "good", "https://evil.test"),
    )
  ).status,
  403,
);
guest = true;
let response = await route.POST(
  req({
    action: "create",
    listing: { ...row, is_id_verified: true, user_id: other },
    actor: other,
  }),
);
assert.equal(response.status, 200);
assert((await response.json()).management_path.includes("#key="));
assert.equal(queries.at(-1).args.p_actor, id);
assert.equal(queries.at(-1).args.p_listing.user_id, undefined);
assert.equal(queries.at(-1).args.p_listing.is_id_verified, undefined);
assert.equal(
  (await route.POST(req({ action: "payment", kind: "multi_listing" }))).status,
  401,
);
guest = false;
assert.equal(
  (await route.POST(req({ action: "payment", kind: "boost", listing_id: id })))
    .status,
  503,
);
process.env.UPI_COLLECTIONS_ENABLED = "true";
response = await route.POST(
  req({ action: "payment", kind: "boost", listing_id: id, amount: 1 }),
);
assert.equal(response.status, 200);
const payment = await response.json();
assert.equal(payment.amount, 29);
const uri = new URL(payment.upi_url);
assert.equal(uri.searchParams.get("pa"), "7428975781@idfcfirst");
assert.equal(uri.searchParams.get("pn"), "Suraj Panigrahi");
assert.equal(uri.searchParams.get("am"), "29.00");
assert.equal((await route.POST(req({ action: "admin" }))).status, 403);
assert.equal(
  (
    await route.POST(
      req({ action: "review_payment", payment_id: id, approve: true }),
    )
  ).status,
  403,
);
assert.equal(
  (await route.POST(req({ action: "utr", payment_id: id, utr: "123" }))).status,
  400,
);
keyActor = other;
response = await route.POST(
  req({ action: "remove", listing_id: id, key: "a".repeat(64) }, null),
);
assert.equal(response.status, 200);
assert.equal(queries.at(-1).name, "portal_remove_listing");
assert.equal(queries.at(-1).args.p_actor, other);
keyActor = null;
assert.equal(
  (
    await route.POST(
      req({ action: "remove", listing_id: id, key: "a".repeat(64) }, null),
    )
  ).status,
  403,
);
assert.equal(
  (await route.GET(new Request("https://tolet.test/api/portal?scope=feed")))
    .status,
  200,
);
rate = false;
assert.equal(
  (await route.POST(req({ action: "create", listing: row }))).status,
  429,
);
process.env.NEXT_PUBLIC_PORTAL_V2_ENABLED = "false";
assert.equal(
  (await route.POST(req({ action: "create", listing: row }))).status,
  503,
);
console.log(
  "PASS portal API: staging gate, guest posting, trusted actor, editable whitelist, CSRF, payment gate/amount/payee, bank-admin restriction, private key access and quota",
);
