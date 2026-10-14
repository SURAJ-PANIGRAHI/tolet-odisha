"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { Listing } from "@/lib/supabase";
import { portalCall } from "@/lib/client/portal";
import { PortalListingEditor } from "./PortalListingEditor";
export function PortalManagement({ listingId }: { listingId: string }) {
  const [key, setKey] = useState(""),
    [listing, setListing] = useState<Listing | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [edit, setEdit] = useState(false);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const savedKey =
        new URLSearchParams(window.location.hash.slice(1)).get("key") || "";
      if (!savedKey)
        throw new Error(
          "Use your saved private management link, or open your signed-in dashboard.",
        );
      const data = await portalCall("read", {
        listing_id: listingId,
        key: savedKey,
      });
      if (!cancelled) {
        setKey(savedKey);
        setListing(data.listing);
      }
    }
    void load().catch((e) => {
      if (!cancelled) setError(e.message);
    });
    return () => {
      cancelled = true;
    };
  }, [listingId]);
  async function action(name: "remove" | "renew") {
    if (busy) return;
    if (
      name === "remove" &&
      !window.confirm("Remove this property from search results?")
    )
      return;
    setBusy(true);
    try {
      await portalCall(name, { listing_id: listingId, key });
      const result = await portalCall("read", { listing_id: listingId, key });
      setListing(result.listing);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to complete request.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="space-y-4">
      <p>
        Keep this link private. Anyone with it can edit, renew or remove your
        property.
      </p>
      {listing ? (
        <>
          <h2 className="text-xl font-bold">{listing.title}</h2>
          <p>
            {listing.is_active ? "Active" : "Inactive"} · Expires{" "}
            {listing.expires_at
              ? new Date(listing.expires_at).toLocaleDateString("en-IN")
              : "—"}
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              disabled={busy}
              onClick={() => setEdit(true)}
              className="rounded border p-3"
            >
              Edit details / photos
            </button>
            <button
              disabled={busy}
              onClick={() => void action("renew")}
              className="rounded border p-3"
            >
              Renew free for 30 days
            </button>
            <button
              disabled={busy || !listing.is_active}
              onClick={() => void action("remove")}
              className="rounded border p-3 text-red-700"
            >
              Remove listing
            </button>
          </div>
          <p>
            For dashboard access, sign in and paste this private link under
            “Attach a guest listing”.
          </p>
          <Link href="/dashboard" className="underline text-[#005B94]">
            Sign in with email or Google
          </Link>
        </>
      ) : null}
      {error ? (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      ) : null}
      {edit && listing ? (
        <PortalListingEditor
          listing={listing}
          managementKey={key}
          onClose={() => setEdit(false)}
          onSaved={() => {
            setEdit(false);
            void portalCall("read", { listing_id: listingId, key })
              .then((r) => setListing(r.listing))
              .catch((e) => setError(e.message));
          }}
        />
      ) : null}
    </section>
  );
}
