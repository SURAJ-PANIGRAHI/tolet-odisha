import { after } from "next/server";
import { dispatchPortalEmails } from "@/lib/server/portal-email";
import { createHash, randomBytes } from "node:crypto";
import { portalUser } from "@/lib/server/portal-auth";
import { serverDb, consumeQuota } from "@/lib/server/lifecycle";
import { isUuid, readJsonLimited } from "@/lib/server/evolution";
import { validatePortalListing } from "@/lib/server/portal-listing";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = {
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
};
const reply = (data: unknown, status = 200) =>
  Response.json(data, { status, headers });
const enabled = () => process.env.NEXT_PUBLIC_PORTAL_V2_ENABLED === "true";
function uuid(value: unknown) {
  if (typeof value !== "string" || !isUuid(value))
    throw new Error("Invalid listing or request ID.");
  return value;
}
function keyHash(value: unknown) {
  if (typeof value !== "string" || !/^[0-9a-f]{64}$/.test(value))
    throw new Error("Invalid management link.");
  return createHash("sha256").update(value).digest("hex");
}
async function rpc(
  db: ReturnType<typeof serverDb>,
  name: string,
  args: Record<string, unknown>,
) {
  const { data, error } = await db.rpc(name, args);
  if (error) throw error;
  return data;
}
export async function GET(request: Request) {
  if (!enabled())
    return reply(
      { error: "The new portal is not enabled on this deployment." },
      503,
    );
  try {
    if (new URL(request.url).searchParams.get("scope") === "feed")
      return reply({
        listings: await rpc(serverDb(), "portal_public_feed", {}),
      });
    const auth = await portalUser(request, true);
    if (!auth)
      return reply({ error: "Please sign in or start a guest session." }, 401);
    const { db, user } = auth;
    const [profile, listings, payments, idStatus, isAdmin] = await Promise.all([
      db.from("portal_profiles").select("*").eq("user_id", user.id).single(),
      db
        .from("portal_listings")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
      db
        .from("portal_payment_requests")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50),
      rpc(db, "portal_my_id_status", { p_actor: user.id }),
      rpc(db, "portal_account_admin", { p_actor: user.id }),
    ]);
    if (profile.error || listings.error || payments.error)
      throw new Error("Dashboard unavailable");
    return reply({
      profile: profile.data,
      listings: listings.data,
      payments: payments.data,
      id_status: idStatus?.[0] || null,
      is_admin: isAdmin,
    });
  } catch {
    return reply(
      {
        error:
          "Dashboard unavailable. Check the staging database configuration.",
      },
      503,
    );
  }
}
export async function POST(request: Request) {
  if (!enabled())
    return reply(
      { error: "The new portal is not enabled on this deployment." },
      503,
    );
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return reply({ error: "Invalid origin." }, 403);
  let input: Record<string, unknown>;
  try {
    const body = await readJsonLimited(request, 24000);
    if (!body || typeof body !== "object" || Array.isArray(body))
      throw new Error();
    input = body as Record<string, unknown>;
  } catch {
    return reply({ error: "Invalid request." }, 400);
  }
  try {
    const action = input.action;
    const allowed = [
      "create",
      "edit",
      "remove",
      "renew",
      "read",
      "claim",
      "profile",
      "payment",
      "utr",
      "report",
      "admin",
      "review_id",
      "review_payment",
      "moderate",
      "redeem",
    ];
    if (typeof action !== "string" || !allowed.includes(action))
      return reply({ error: "Unknown action." }, 400);
    if (!(await consumeQuota("portal-actions-global", 1000)))
      return reply({ error: "Please try again later." }, 429);
    const auth = await portalUser(request, true);
    const db = auth?.db || serverDb();
    let actor = auth?.user.id;
    const listingId =
      input.listing_id == null ? undefined : uuid(input.listing_id);
    const managementActions = ["read", "edit", "remove", "renew"];
    if (input.key != null && listingId && managementActions.includes(action)) {
      actor = await rpc(db, "portal_management_actor", {
        p_listing: listingId,
        p_hash: keyHash(input.key),
      });
      if (!actor) return reply({ error: "Invalid management link." }, 403);
    }
    if (action === "redeem") {
      if (
        typeof input.token !== "string" ||
        !/^[0-9a-f]{64}$/.test(input.token)
      )
        return reply({ error: "Invalid renewal link." }, 400);
      await rpc(db, "portal_redeem_renewal_token", { p_token: input.token });
      return reply({ renewed: true });
    }
    if (!actor)
      return reply({ error: "Please sign in or start a guest session." }, 401);
    if (["admin", "review_id", "review_payment", "moderate"].includes(action)) {
      if (
        !auth ||
        !(await rpc(db, "portal_account_admin", { p_actor: auth.user.id }))
      )
        return reply({ error: "Administrator access required." }, 403);
      actor = auth.user.id;
    }
    switch (action) {
      case "create": {
        const row = validatePortalListing(input.listing);
        if (!(await consumeQuota("portal-post-global", 50)))
          return reply({ error: "Please try again later." }, 429);
        const key = randomBytes(32).toString("hex");
        const id = await rpc(db, "portal_post_listing", {
          p_actor: actor,
          p_listing: row,
          p_hash: keyHash(key),
        });
        return reply({
          saved: true,
          management_path: `/manage?portal=1&listing=${id}#key=${key}`,
        });
      }
      case "read": {
        if (!listingId) throw new Error("Listing ID required.");
        const result = await db
          .from("portal_listings")
          .select("*")
          .eq("id", listingId)
          .eq("user_id", actor)
          .single();
        if (result.error) return reply({ error: "Listing unavailable." }, 404);
        return reply({ listing: result.data });
      }
      case "edit":
        await rpc(db, "portal_edit_listing", {
          p_actor: actor,
          p_listing: uuid(input.listing_id),
          p_data: validatePortalListing(input.listing),
        });
        return reply({ saved: true });
      case "remove":
        await rpc(db, "portal_remove_listing", {
          p_actor: actor,
          p_listing: uuid(input.listing_id),
        });
        return reply({ removed: true });
      case "renew":
        return reply({
          expires_at: await rpc(db, "portal_renew_listing", {
            p_actor: actor,
            p_listing: uuid(input.listing_id),
          }),
        });
      case "claim":
        if (!auth || auth.user.is_anonymous || !auth.user.email_confirmed_at)
          return reply(
            {
              error: "Sign in with email or Google before attaching a listing.",
            },
            401,
          );
        await rpc(db, "portal_claim_listing", {
          p_actor: auth.user.id,
          p_listing: uuid(input.listing_id),
          p_hash: keyHash(input.key),
        });
        return reply({ claimed: true });
      case "profile": {
        if (
          typeof input.name !== "string" ||
          input.name.trim().length < 2 ||
          input.name.trim().length > 120
        )
          return reply(
            { error: "Enter your full name, up to 120 characters." },
            400,
          );
        const { error } = await db
          .from("portal_profiles")
          .update({ display_name: input.name.trim() })
          .eq("user_id", actor);
        if (error) throw error;
        return reply({ saved: true });
      }
      case "payment": {
        if (input.kind !== "boost" && input.kind !== "multi_listing")
          return reply({ error: "Invalid plan." }, 400);
        if (!auth || auth.user.is_anonymous || !auth.user.email_confirmed_at)
          return reply(
            {
              error:
                "Sign in with email or Google to buy and track a paid feature.",
            },
            401,
          );
        if (process.env.UPI_COLLECTIONS_ENABLED !== "true")
          return reply(
            { error: "Payments are not enabled on this deployment yet." },
            503,
          );
        if (!(await consumeQuota("portal-payments-global", 100)))
          return reply({ error: "Please try later." }, 429);
        if (input.kind === "boost") {
          const owned = await db
            .from("portal_listings")
            .select("id")
            .eq("user_id", actor)
            .eq("id", uuid(input.listing_id))
            .eq("is_active", true)
            .gt("expires_at", new Date().toISOString())
            .single();
          if (owned.error)
            return reply(
              { error: "Choose one of your active listings to boost." },
              400,
            );
        }
        const id = await rpc(db, "portal_create_payment", {
          p_actor: actor,
          p_kind: input.kind,
          p_listing: input.kind === "boost" ? uuid(input.listing_id) : null,
        });
        const amount = input.kind === "boost" ? 29 : 49;
        const query = new URLSearchParams({
          pa: "7428975781@idfcfirst",
          pn: "Suraj Panigrahi",
          am: amount.toFixed(2),
          cu: "INR",
          tn: `ToLet ${id}`,
        });
        return reply({
          payment_id: id,
          amount,
          upi_url: `upi://pay?${query}`,
          qr_path: `/payments/upi-${amount}.jpeg`,
        });
      }
      case "utr":
        if (typeof input.utr !== "string" || !/^[0-9]{12}$/.test(input.utr))
          return reply(
            { error: "Enter the 12-digit UPI transaction reference." },
            400,
          );
        await rpc(db, "portal_submit_utr", {
          p_actor: actor,
          p_payment: uuid(input.payment_id),
          p_utr: input.utr,
        });
        return reply({ pending: true });
      case "report":
        if (
          ![
            "Fake listing",
            "Scam / Fraud",
            "Wrong contact number",
            "Already rented",
            "Misleading photos",
            "Wrong information",
            "Duplicate listing",
            "Other",
          ].includes(String(input.reason)) ||
          typeof input.description !== "string" ||
          input.description.length > 2000 ||
          (input.reason === "Other" && !input.description.trim())
        )
          return reply(
            { error: "Choose a reason and enter a valid note." },
            400,
          );
        await rpc(db, "portal_report_listing", {
          p_actor: actor,
          p_listing: uuid(input.listing_id),
          p_reason: input.reason,
          p_description: input.description,
        });
        after(async () => {
          try {
            await dispatchPortalEmails(2);
          } catch {
            /* Queued jobs retry in the cron dispatcher. */
          }
        });
        return reply({ saved: true, notification: "queued" });
      case "admin": {
        const docs = await rpc(db, "portal_admin_pending_ids", {
          p_admin: actor,
        });
        const documents = await Promise.all(
          (docs || []).map(async (d: { object_path: string }) => {
            const signed = await db.storage
              .from("portal-government-ids")
              .createSignedUrl(d.object_path, 60);
            if (signed.error) throw signed.error;
            return { ...d, document_url: signed.data.signedUrl };
          }),
        );
        const [payments, reports, listings] = await Promise.all([
          db
            .from("portal_payment_requests")
            .select("*")
            .eq("status", "pending")
            .not("claimed_utr", "is", null)
            .limit(100),
          db.from("portal_reports").select("*").eq("status", "open").limit(100),
          db
            .from("portal_listings")
            .select("*")
            .eq("moderation_status", "quarantined")
            .limit(100),
        ]);
        if (payments.error || reports.error || listings.error)
          throw new Error("Queue unavailable");
        return reply({
          documents,
          payments: payments.data,
          reports: reports.data,
          listings: listings.data,
        });
      }
      case "review_id":
        if (typeof input.approve !== "boolean")
          throw new Error("Decision required.");
        await rpc(db, "portal_review_id", {
          p_admin: actor,
          p_document: uuid(input.document_id),
          p_approve: input.approve,
          p_reason: input.reason || null,
        });
        return reply({ reviewed: true });
      case "review_payment":
        if (typeof input.approve !== "boolean")
          throw new Error("Decision required.");
        if (
          input.approve &&
          (typeof input.utr !== "string" ||
            !/^[0-9]{12}$/.test(input.utr) ||
            ![2900, 4900].includes(Number(input.amount_paise)) ||
            typeof input.received_at !== "string" ||
            !Number.isFinite(Date.parse(input.received_at)))
        )
          return reply(
            {
              error:
                "Enter the actual bank UTR, credited amount and received time.",
            },
            400,
          );
        await rpc(db, "portal_review_payment", {
          p_admin: actor,
          p_payment: uuid(input.payment_id),
          p_approve: input.approve,
          p_observed_utr: input.utr || null,
          p_observed_amount_paise: input.amount_paise || null,
          p_bank_received_at: input.received_at || null,
          p_reason: input.reason || null,
        });
        return reply({ reviewed: true });
      case "moderate":
        if (typeof input.approve !== "boolean")
          throw new Error("Decision required.");
        await rpc(db, "portal_moderate_listing", {
          p_admin: actor,
          p_listing: uuid(input.listing_id),
          p_approve: input.approve,
        });
        return reply({ reviewed: true });
    }
  } catch (cause) {
    const error = cause as { message?: string; code?: string };
    if (error.message?.includes("MULTI_LISTING_PACK_REQUIRED"))
      return reply(
        {
          error:
            "Your account already has an active property. Activate the ₹49 / 30 days multi-listing pack to add another.",
        },
        409,
      );
    if (error.code === "42501")
      return reply({ error: "You do not have access to this request." }, 403);
    if (error.message?.includes("moderation"))
      return reply(
        { error: "This listing needs admin review before it can be renewed." },
        409,
      );
    return reply(
      {
        error:
          "Unable to complete this request. Check the details and try again.",
      },
      400,
    );
  }
}
