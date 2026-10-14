"use client";
/* eslint-disable @next/next/no-img-element -- Keep private signed URLs and original payment QR images out of image optimisers. */
import { useState } from "react";
import { useModal } from "@/lib/client/useModal";
import { portalCall } from "@/lib/client/portal";
type Checkout = {
  payment_id: string;
  amount: number;
  upi_url: string;
  qr_path: string;
};
export function PortalPayment({
  kind,
  listing_id,
  onClose,
}: {
  kind: "boost" | "multi_listing";
  listing_id?: string;
  onClose: () => void;
}) {
  const [checkout, setCheckout] = useState<Checkout | null>(null),
    [utr, setUtr] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [submitted, setSubmitted] = useState(false);
  async function start() {
    if (busy || checkout) return;
    setBusy(true);
    setError("");
    try {
      setCheckout(await portalCall("payment", { kind, listing_id }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to create payment.");
    } finally {
      setBusy(false);
    }
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!checkout || busy) return;
    setBusy(true);
    setError("");
    try {
      await portalCall("utr", { payment_id: checkout.payment_id, utr });
      setSubmitted(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to submit reference.");
    } finally {
      setBusy(false);
    }
  }
  const modal = useModal(() => {
    if (!busy) onClose();
  });
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 p-4 flex items-center justify-center">
      <section
        ref={modal}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="payment-heading"
        className="max-h-[90vh] overflow-y-auto w-full max-w-lg rounded-2xl bg-white p-6 space-y-4"
      >
        <h2 id="payment-heading" className="text-xl font-bold">
          {kind === "boost"
            ? "Boost your views · ₹29 / 30 days"
            : "Multiple properties · ₹49 / 30 days"}
        </h2>
        <p>
          {kind === "boost"
            ? "Higher placement and a Featured badge for this property."
            : "List more than one active property from your account."}{" "}
          Payment does not verify your identity.
        </p>
        {submitted ? (
          <p role="status">
            Payment reference submitted. Your plan will activate after the
            administrator confirms the bank credit.
          </p>
        ) : checkout ? (
          <>
            <p>
              Payee: <strong>Suraj Panigrahi</strong>
              <br />
              UPI: <strong>7428975781@idfcfirst</strong>
            </p>
            <a
              href={checkout.upi_url}
              className="block rounded bg-[#005B94] p-3 text-center text-white"
            >
              Pay ₹{checkout.amount} using UPI
            </a>
            <img
              src={checkout.qr_path}
              alt={`IDFC FIRST Bank UPI QR for ₹${checkout.amount}, Suraj Panigrahi`}
              className="mx-auto w-64"
            />
            <p className="text-sm text-slate-600">
              Check the payee and amount in your UPI app before paying. The QR
              has a fixed amount; it does not automatically identify this order.
            </p>
            <form onSubmit={submit} className="space-y-3">
              <label htmlFor="payment-utr">
                12-digit UPI transaction reference
              </label>
              <input
                id="payment-utr"
                value={utr}
                onChange={(e) =>
                  setUtr(e.target.value.replace(/\D/g, "").slice(0, 12))
                }
                inputMode="numeric"
                pattern="[0-9]{12}"
                required
                className="w-full rounded border p-3"
              />
              <button disabled={busy} className="rounded border p-3">
                Submit for bank-credit review
              </button>
            </form>
            <p className="text-xs break-all">
              Payment request: {checkout.payment_id}
            </p>
          </>
        ) : (
          <button
            disabled={busy}
            onClick={() => void start()}
            className="rounded bg-[#005B94] p-3 text-white"
          >
            Continue to UPI checkout
          </button>
        )}
        {error ? (
          <p role="alert" className="text-red-700">
            {error}
          </p>
        ) : null}
        <button disabled={busy} onClick={onClose} className="underline">
          Close
        </button>
      </section>
    </div>
  );
}
