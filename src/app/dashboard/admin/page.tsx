"use client";
/* eslint-disable @next/next/no-img-element -- Keep private signed URLs and original payment QR images out of image optimisers. */
import Link from "next/link";
import { useEffect, useState } from "react";
import { portalCall } from "@/lib/client/portal";
type Document = {
  document_id: string;
  account_name: string;
  document_type: string;
  document_url: string;
  submitted_at: string;
};
type Payment = {
  id: string;
  kind: string;
  amount_paise: number;
  claimed_utr: string;
  user_id: string;
};
type Report = {
  id: string;
  listing_id: string;
  reason: string;
  description: string;
};
type Row = { id: string; title: string; moderation_status: string };
type Queue = {
  documents: Document[];
  payments: Payment[];
  reports: Report[];
  listings: Row[];
};
export default function PortalAdmin() {
  const [queue, setQueue] = useState<Queue | null>(null),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function refresh() {
    try {
      setQueue(await portalCall("admin"));
      setMessage("");
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "Unable to load review queues.",
      );
    }
  }
  useEffect(() => {
    let cancelled = false;
    portalCall("admin")
      .then((q) => {
        if (!cancelled) setQueue(q);
      })
      .catch((e) => {
        if (!cancelled) setMessage(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  async function review(action: string, data: Record<string, unknown>) {
    if (busy) return;
    setBusy(true);
    try {
      await portalCall(action, data);
      await refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Review failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6">
      <Link href="/dashboard" className="underline">
        ← Dashboard
      </Link>
      <h1 className="text-3xl font-bold">Admin review</h1>
      <p>
        Sign in through the dashboard with your authorised administrator
        account. Review reported properties, submitted IDs and actual bank
        credits.
      </p>
      <button
        disabled={busy}
        onClick={() => void refresh()}
        className="rounded border p-3"
      >
        Refresh queues / private image links
      </button>
      {message ? (
        <p role="alert" className="text-red-700">
          {message}
        </p>
      ) : null}
      {queue ? (
        <>
          <section className="space-y-4">
            <h2 className="text-xl font-bold">Government ID review</h2>
            {queue.documents.map((d) => (
              <article
                key={d.document_id}
                className="grid gap-4 rounded-xl border bg-white p-4 md:grid-cols-2"
              >
                <div>
                  <img
                    src={d.document_url}
                    alt="Private ID document for administrative review"
                    className="max-h-80 max-w-full object-contain"
                  />
                </div>
                <div className="space-y-3">
                  <p>
                    <strong>Account name:</strong> {d.account_name}
                  </p>
                  <p>
                    {d.document_type} ·{" "}
                    {new Date(d.submitted_at).toLocaleString()}
                  </p>
                  <p className="text-sm">
                    Compare the document name with the account name. Image links
                    expire after 60 seconds.
                  </p>
                  <button
                    disabled={busy}
                    onClick={() =>
                      void review("review_id", {
                        document_id: d.document_id,
                        approve: true,
                      })
                    }
                    className="rounded border p-2"
                  >
                    Approve ID
                  </button>
                  <label className="block">
                    Reject with reason
                    <select
                      defaultValue=""
                      disabled={busy}
                      onChange={(e) => {
                        if (e.target.value)
                          void review("review_id", {
                            document_id: d.document_id,
                            approve: false,
                            reason: e.target.value,
                          });
                      }}
                      className="block w-full rounded border p-2"
                    >
                      <option value="">Select reason</option>
                      {["Blurry image", "Name mismatch", "Incomplete ID"].map(
                        (r) => (
                          <option key={r}>{r}</option>
                        ),
                      )}
                    </select>
                  </label>
                </div>
              </article>
            ))}
            {!queue.documents.length ? <p>No pending IDs.</p> : null}
          </section>
          <section className="space-y-4">
            <h2 className="text-xl font-bold">UPI bank-credit review</h2>
            <p>
              Verify the payment in your bank account. A submitted reference or
              screenshot is not proof of credit.
            </p>
            {queue.payments.map((p) => (
              <PaymentReview
                key={p.id}
                payment={p}
                busy={busy}
                onReview={review}
              />
            ))}
            {!queue.payments.length ? (
              <p>No submitted payment references awaiting review.</p>
            ) : null}
          </section>
          <section className="space-y-4">
            <h2 className="text-xl font-bold">Reported properties</h2>
            {queue.listings.map((l) => (
              <article key={l.id} className="rounded-xl border p-4 space-y-3">
                <h3 className="font-bold">{l.title}</h3>
                {queue.reports
                  .filter((r) => r.listing_id === l.id)
                  .map((r) => (
                    <p key={r.id}>
                      {r.reason}: {r.description || "No note"}
                    </p>
                  ))}
                <button
                  disabled={busy}
                  onClick={() =>
                    void review("moderate", { listing_id: l.id, approve: true })
                  }
                  className="rounded border p-2"
                >
                  Clear reports — owner may renew
                </button>
                <button
                  disabled={busy}
                  onClick={() =>
                    void review("moderate", {
                      listing_id: l.id,
                      approve: false,
                    })
                  }
                  className="rounded border p-2 text-red-700"
                >
                  Reject listing
                </button>
              </article>
            ))}
            {queue.reports
              .filter((r) => !queue.listings.some((l) => l.id === r.listing_id))
              .map((r) => (
                <article key={r.id} className="rounded border p-4">
                  <p>
                    Listing {r.listing_id}: {r.reason} — {r.description}
                  </p>
                  <button
                    disabled={busy}
                    onClick={() =>
                      void review("moderate", {
                        listing_id: r.listing_id,
                        approve: false,
                      })
                    }
                    className="underline text-red-700"
                  >
                    Remove after review
                  </button>
                </article>
              ))}
            {!queue.reports.length ? <p>No open reports.</p> : null}
          </section>
        </>
      ) : null}
    </main>
  );
}
function PaymentReview({
  payment: p,
  busy,
  onReview,
}: {
  payment: Payment;
  busy: boolean;
  onReview: (action: string, data: Record<string, unknown>) => Promise<void>;
}) {
  const [utr, setUtr] = useState(""),
    [amount, setAmount] = useState(""),
    [received, setReceived] = useState(""),
    [confirmed, setConfirmed] = useState(false),
    [reason, setReason] = useState("");
  return (
    <article className="rounded-xl border p-4 space-y-3">
      <p>
        <strong>
          {p.kind === "boost" ? "Boost" : "Multi-listing pack"} · ₹
          {p.amount_paise / 100}
        </strong>
      </p>
      <p className="break-all text-sm">
        Request: {p.id}
        <br />
        Claimed reference: {p.claimed_utr}
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void onReview("review_payment", {
            payment_id: p.id,
            approve: true,
            utr,
            amount_paise: Math.round(Number(amount) * 100),
            received_at: new Date(received).toISOString(),
          });
        }}
        className="space-y-3"
      >
        <label className="block">
          UTR observed in bank statement
          <input
            required
            pattern="[0-9]{12}"
            value={utr}
            onChange={(e) => setUtr(e.target.value)}
            className="block w-full rounded border p-2"
          />
        </label>
        <label className="block">
          Actual amount credited (₹)
          <input
            required
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="block w-full rounded border p-2"
          />
        </label>
        <label className="block">
          Bank credit date/time (your local time)
          <input
            required
            type="datetime-local"
            value={received}
            onChange={(e) => setReceived(e.target.value)}
            className="block w-full rounded border p-2"
          />
        </label>
        <label className="flex gap-2">
          <input
            required
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
          />
          I checked the actual bank credit, amount and reference.
        </label>
        <button disabled={busy || !confirmed} className="rounded border p-2">
          Approve payment and activate
        </button>
      </form>
      <label className="block">
        Rejection reason
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="block w-full rounded border p-2"
        />
      </label>
      <button
        disabled={busy || !reason.trim()}
        onClick={() =>
          void onReview("review_payment", {
            payment_id: p.id,
            approve: false,
            reason,
          })
        }
        className="rounded border p-2 text-red-700"
      >
        Reject payment request
      </button>
    </article>
  );
}
