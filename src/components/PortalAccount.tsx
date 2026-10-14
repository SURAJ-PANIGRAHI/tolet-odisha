"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { supabase, type Listing } from "@/lib/supabase";
import { portalCall, portalDashboard } from "@/lib/client/portal";
import { WhatsAppVerification } from "./WhatsAppVerification";
import { PortalListingEditor } from "./PortalListingEditor";
import { PortalPayment } from "./PortalPayment";
type Profile = {
  display_name: string;
  is_email_verified: boolean;
  is_phone_verified: boolean;
  is_id_verified: boolean;
  multi_listing_expires_at: string | null;
};
type Payment = {
  id: string;
  kind: string;
  amount_paise: number;
  status: string;
  claimed_utr: string | null;
};
type IdStatus = { status: string; rejection_reason: string | null };
type Account = {
  profile: Profile;
  listings: Listing[];
  payments: Payment[];
  id_status: IdStatus | null;
  is_admin: boolean;
};
export function PortalAccount() {
  const [account, setAccount] = useState<Account | null>(null),
    [error, setError] = useState(""),
    [name, setName] = useState(""),
    [busy, setBusy] = useState(false),
    [edit, setEdit] = useState<Listing | null>(null),
    [payment, setPayment] = useState<{
      kind: "boost" | "multi_listing";
      listing_id?: string;
    } | null>(null);
  const [file, setFile] = useState<File | null>(null),
    [idType, setIdType] = useState("passport"),
    [consent, setConsent] = useState(false),
    [managementLink, setManagementLink] = useState("");
  const refresh = useCallback(async () => {
    try {
      const result = await portalDashboard();
      setAccount(result);
      setName(result.profile.display_name);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load account.");
    }
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    portalDashboard(controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) {
          setAccount(result);
          setName(result.profile.display_name);
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, []);
  async function action(task: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await task();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to complete request.");
    } finally {
      setBusy(false);
    }
  }
  async function upload() {
    if (!file || !consent)
      throw new Error("Select an ID image and provide consent.");
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw new Error("Please sign in again.");
    const form = new FormData();
    form.set("document", file);
    form.set("type", idType);
    form.set("consent", "yes");
    const response = await fetch("/api/portal/id", {
      method: "POST",
      headers: { Authorization: `Bearer ${data.session.access_token}` },
      body: form,
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    setFile(null);
    setConsent(false);
  }
  async function attach() {
    const url = new URL(managementLink, window.location.origin);
    if (
      url.origin !== window.location.origin ||
      url.pathname !== "/manage" ||
      url.searchParams.get("portal") !== "1"
    )
      throw new Error(
        "Paste the new portal management link from this website.",
      );
    const key = new URLSearchParams(url.hash.slice(1)).get("key");
    await portalCall("claim", {
      listing_id: url.searchParams.get("listing"),
      key,
    });
    setManagementLink("");
  }
  if (!account)
    return (
      <section className="rounded-xl border bg-white p-5">
        <p role="status">{error || "Loading dashboard…"}</p>
        {error ? (
          <button onClick={() => void refresh()} className="underline">
            Retry
          </button>
        ) : null}
      </section>
    );
  return (
    <div className="space-y-6">
      {error ? (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-700">
          {error}
        </p>
      ) : null}
      <section className="rounded-2xl border bg-white p-6 space-y-3">
        <h2 className="text-xl font-bold">Your account</h2>
        <label htmlFor="account-name">Full name for ID review</label>
        <input
          id="account-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded border p-3"
        />
        <button
          disabled={busy}
          onClick={() => void action(() => portalCall("profile", { name }))}
          className="rounded border px-4 py-2"
        >
          Save name
        </button>
        <p className="text-sm text-slate-600">
          Changing your account name removes an existing ID badge until reviewed
          again.
        </p>
        <p>
          <strong>Verification builds trust.</strong> Verified listings receive
          higher placement.
        </p>
      </section>
      <WhatsAppVerification />
      <section className="rounded-2xl border bg-white p-6 space-y-3">
        <h2 className="text-xl font-bold">Government ID verification</h2>
        <p>
          {account.profile.is_id_verified
            ? "Govt ID Verified 🛡️"
            : account.id_status?.status === "pending"
              ? "Verification Pending (Up to 48 Hours)"
              : account.id_status?.status === "rejected"
                ? `Rejected: ${account.id_status.rejection_reason}`
                : "ID: Not verified"}
        </p>
        <p className="text-sm text-slate-600">
          Only passport, masked Aadhaar, driving licence and voter ID are
          accepted. Documents are private and reviewed by an administrator.
          Uploaded files are deleted after all your listings have been inactive
          for seven days. Rejected documents are queued for earlier deletion.
        </p>
        {!account.id_status || account.id_status.status === "deleted" ? (
          <>
            <label htmlFor="id-type">ID type</label>
            <select
              id="id-type"
              value={idType}
              onChange={(e) => setIdType(e.target.value)}
              className="w-full rounded border p-3"
            >
              <option value="passport">Passport</option>
              <option value="masked_aadhaar">Masked Aadhaar</option>
              <option value="driving_licence">Driving licence</option>
              <option value="voter_id">Voter ID</option>
            </select>
            <label htmlFor="id-file">
              ID image · JPEG, PNG or WebP · Maximum 3 MB
            </label>
            <input
              id="id-file"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            <label className="flex gap-2">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
              />
              <span>
                I agree to upload this document for private identity review and
                the stated retention period.
              </span>
            </label>
            <button
              disabled={busy || !file || !consent}
              onClick={() => void action(upload)}
              className="rounded bg-[#005B94] px-4 py-2 text-white disabled:opacity-50"
            >
              Submit for review
            </button>
          </>
        ) : null}
      </section>
      <section className="rounded-2xl border bg-white p-6 space-y-4">
        <h2 className="text-xl font-bold">Your properties</h2>
        <p>
          One active property is free. Listings expire after 30 days and can be
          renewed free.
        </p>
        <button
          disabled={busy}
          onClick={() => setPayment({ kind: "multi_listing" })}
          className="rounded border px-4 py-2"
        >
          Multiple properties · ₹49 / 30 days
        </button>
        <p className="text-sm text-slate-600">
          {account.profile.multi_listing_expires_at
            ? `Pack paid until ${new Date(account.profile.multi_listing_expires_at).toLocaleDateString("en-IN")}`
            : "No active multi-listing pack."}
        </p>
        {account.listings.length === 0 ? (
          <p>
            No properties yet.{" "}
            <Link href="/" className="underline">
              Post your first listing.
            </Link>
          </p>
        ) : (
          account.listings.map((row) => (
            <article key={row.id} className="rounded-xl border p-4 space-y-2">
              <h3 className="font-bold">{row.title}</h3>
              <p className="text-sm">
                {row.is_active ? "Active" : "Inactive"} · Expires{" "}
                {row.expires_at
                  ? new Date(row.expires_at).toLocaleDateString("en-IN")
                  : "—"}
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  disabled={busy}
                  onClick={() => setEdit(row)}
                  className="rounded border p-2"
                >
                  Edit / photos
                </button>
                <button
                  disabled={busy}
                  onClick={() =>
                    void action(() =>
                      portalCall("renew", { listing_id: row.id }),
                    )
                  }
                  className="rounded border p-2"
                >
                  Renew free
                </button>
                <button
                  disabled={busy || !row.is_active}
                  onClick={() =>
                    setPayment({ kind: "boost", listing_id: row.id })
                  }
                  className="rounded border p-2"
                >
                  Boost your views · ₹29
                </button>
                <button
                  disabled={busy || !row.is_active}
                  onClick={() => {
                    if (
                      window.confirm("Remove this listing from search results?")
                    )
                      void action(() =>
                        portalCall("remove", { listing_id: row.id }),
                      );
                  }}
                  className="rounded border p-2 text-red-700"
                >
                  Remove
                </button>
              </div>
            </article>
          ))
        )}
      </section>
      <section className="rounded-2xl border bg-white p-6 space-y-3">
        <h2 className="text-xl font-bold">Attach a guest listing</h2>
        <label htmlFor="attach-link">Paste its private management link</label>
        <input
          id="attach-link"
          type="url"
          value={managementLink}
          onChange={(e) => setManagementLink(e.target.value)}
          className="w-full rounded border p-3"
        />
        <button
          disabled={busy || !managementLink}
          onClick={() => void action(attach)}
          className="rounded border p-2"
        >
          Attach to my signed-in account
        </button>
        <p className="text-sm text-slate-600">
          Signing in with email or Google is required. After attachment, the old
          management link stops working. Existing anonymous listings from the
          old system need support-assisted migration.
        </p>
      </section>
      <section className="rounded-2xl border bg-white p-6 space-y-3">
        <h2 className="text-xl font-bold">Payment history</h2>
        {account.payments.map((p) => (
          <p key={p.id}>
            {p.kind === "boost" ? "Boost" : "Multi-listing pack"} · ₹
            {p.amount_paise / 100} · {p.status}
            {p.status === "pending" && !p.claimed_utr
              ? " — awaiting transaction reference"
              : ""}
          </p>
        ))}
        {!account.payments.length ? <p>No payments yet.</p> : null}
        <button onClick={() => void refresh()} className="underline">
          Refresh status
        </button>
      </section>
      {account.is_admin ? (
        <Link
          href="/dashboard/admin"
          className="block underline text-[#005B94]"
        >
          Open ID, payment and report review
        </Link>
      ) : null}
      {edit ? (
        <PortalListingEditor
          listing={edit}
          onClose={() => setEdit(null)}
          onSaved={() => {
            setEdit(null);
            void refresh();
          }}
        />
      ) : null}
      {payment ? (
        <PortalPayment
          {...payment}
          onClose={() => {
            setPayment(null);
            void refresh();
          }}
        />
      ) : null}
    </div>
  );
}
