"use client";
/* eslint-disable @next/next/no-img-element -- Keep private signed URLs and original payment QR images out of image optimisers. */
import { useState } from "react";
import { useModal } from "@/lib/client/useModal";
import { supabase, type Listing } from "@/lib/supabase";
import { portalCall } from "@/lib/client/portal";
import {
  CATEGORIES,
  COMMERCIAL_TYPES,
  ODISHA_DISTRICTS,
  DISTRICT_LOCALITIES,
  POPULAR_AMENITIES,
  toggleAmenitySelection,
} from "@/data/odisha";
export function PortalListingEditor({
  listing,
  managementKey,
  persistListing,
  onClose,
  onSaved,
}: {
  listing: Listing;
  managementKey?: string;
  persistListing?: (listing: Listing) => Promise<unknown>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [row, setRow] = useState<Listing>(listing),
    [files, setFiles] = useState<File[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const localities = DISTRICT_LOCALITIES[row.district] || [];
  const [other, setOther] = useState(!localities.includes(listing.locality));
  function field<K extends keyof Listing>(key: K, value: Listing[K]) {
    setRow((r) => ({ ...r, [key]: value }));
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (row.images.length + files.length > 10)
        throw new Error("Use up to 10 photos.");
      const images = [...row.images];
      for (const file of files) {
        if (
          !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
          file.size > 5 * 1024 * 1024
        )
          throw new Error("Photos must be JPEG, PNG or WebP, up to 5 MB.");
        const ext = {
          "image/jpeg": "jpg",
          "image/png": "png",
          "image/webp": "webp",
        }[file.type];
        const path = `listings/${crypto.randomUUID()}.${ext}`;
        const upload = await supabase.storage
          .from("listing-images")
          .upload(path, file, { contentType: file.type });
        if (upload.error) throw upload.error;
        images.push(
          supabase.storage.from("listing-images").getPublicUrl(path).data
            .publicUrl,
        );
      }
      if (persistListing) await persistListing({ ...row, images });
      else await portalCall("edit", {
        listing_id: row.id,
        key: managementKey,
        listing: { ...row, images },
      });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save.");
    } finally {
      setBusy(false);
    }
  }
  const modal = useModal(() => {
    if (!busy) onClose();
  });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <section
        ref={modal}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="editor-heading"
        className="w-full max-w-xl max-h-[90vh] overflow-y-auto portal-dialog portal-form p-6"
      >
        <h2 id="editor-heading" className="text-xl font-bold mb-4">
          Edit property
        </h2>
        <form onSubmit={save} className="space-y-3">
          <label className="block">
            Title
            <input
              required
              value={row.title}
              onChange={(e) => field("title", e.target.value)}
              className="w-full rounded-xl border border-slate-300 p-3"
            />
          </label>
          <label className="block">
            Description
            <textarea
              value={row.description || ""}
              onChange={(e) => field("description", e.target.value)}
              className="w-full rounded-xl border border-slate-300 p-3"
            />
          </label>
          <label className="block">
            Property type
            <select
              value={row.category}
              onChange={(e) =>
                setRow((r) => ({
                  ...r,
                  category: e.target.value,
                  commercial_type:
                    e.target.value === "Commercial / Shop"
                      ? "Office Space"
                      : null,
                }))
              }
              className="w-full rounded-xl border border-slate-300 p-3"
            >
              {CATEGORIES.filter((c) => c.id !== "All").map((c) => (
                <option key={c.id} value={c.id}>
                  {c.id}
                </option>
              ))}
            </select>
          </label>
          {row.category === "Commercial / Shop" ? (
            <label className="block">
              Commercial type
              <select
                value={row.commercial_type || "Office Space"}
                onChange={(e) => field("commercial_type", e.target.value)}
                className="w-full rounded-xl border border-slate-300 p-3"
              >
                {COMMERCIAL_TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="block">
            Listed by
            <select
              required
              value={row.advertiser_type || ""}
              onChange={(e) =>
                field(
                  "advertiser_type",
                  e.target.value as Listing["advertiser_type"],
                )
              }
              className="w-full rounded-xl border border-slate-300 p-3"
            >
              <option value="">Select</option>
              {["Owner", "Broker", "Third Party"].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <label className="block">
            Monthly rent (₹)
            <input
              required
              type="number"
              min="0"
              max="10000000"
              step="1"
              value={row.rent_monthly}
              onChange={(e) => field("rent_monthly", Number(e.target.value))}
              className="w-full rounded-xl border border-slate-300 p-3"
            />
          </label>
          <label className="block">
            Deposit (₹)
            <input
              type="number"
              min="0"
              max="10000000"
              step="1"
              value={row.deposit}
              onChange={(e) => field("deposit", Number(e.target.value))}
              className="w-full rounded-xl border border-slate-300 p-3"
            />
          </label>
          <label className="block">
            Area in square feet (optional)
            <input
              type="number"
              min="1"
              max="10000000"
              step="1"
              value={row.area_sqft ?? ""}
              onChange={(e) =>
                field(
                  "area_sqft",
                  e.target.value ? Number(e.target.value) : null,
                )
              }
              className="w-full rounded-xl border border-slate-300 p-3"
            />
          </label>
          <label className="block">
            District
            <select
              value={row.district}
              onChange={(e) => {
                setRow((r) => ({
                  ...r,
                  district: e.target.value,
                  locality: "",
                }));
                setOther(false);
              }}
              className="w-full rounded-xl border border-slate-300 p-3"
            >
              {ODISHA_DISTRICTS.filter((d) => d !== "All").map((d) => (
                <option key={d} value={d.split(" ")[0]}>
                  {d}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            Locality
            <select
              required
              value={other ? "__other" : row.locality}
              onChange={(e) => {
                setOther(e.target.value === "__other");
                field(
                  "locality",
                  e.target.value === "__other" ? "" : e.target.value,
                );
              }}
              className="w-full rounded-xl border border-slate-300 p-3"
            >
              <option value="">Select</option>
              {localities
                .filter((t) => !t.startsWith("Other"))
                .map((t) => (
                  <option key={t}>{t}</option>
                ))}
              <option value="__other">Others</option>
            </select>
          </label>
          {other ? (
            <label className="block">
              Enter locality
              <input
                required
                value={row.locality}
                onChange={(e) => field("locality", e.target.value)}
                className="w-full rounded-xl border border-slate-300 p-3"
              />
            </label>
          ) : null}
          <label className="block">
            Landmark
            <input
              value={row.landmark || ""}
              onChange={(e) => field("landmark", e.target.value)}
              className="w-full rounded-xl border border-slate-300 p-3"
            />
          </label>
          <label className="block">
            Contact name
            <input
              required
              value={row.contact_name}
              onChange={(e) => field("contact_name", e.target.value)}
              className="w-full rounded-xl border border-slate-300 p-3"
            />
          </label>
          <label className="block">
            Contact phone
            <input
              required
              type="tel"
              value={row.contact_phone}
              onChange={(e) => field("contact_phone", e.target.value)}
              className="w-full rounded-xl border border-slate-300 p-3"
            />
          </label>
          <fieldset>
            <legend>Amenities</legend>
            <div className="flex flex-wrap gap-3">
              {POPULAR_AMENITIES.map((a) => (
                <label key={a}>
                  <input
                    type="checkbox"
                    checked={row.amenities.includes(a)}
                    onChange={(e) =>
                      field(
                        "amenities",
                        e.target.checked
                          ? toggleAmenitySelection(row.amenities.filter(x => x !== a), a)
                          : row.amenities.filter((x) => x !== a),
                      )
                    }
                  />{" "}
                  {a}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>Photos</legend>
            {row.images.map((url, i) => (
              <div key={url} className="flex items-center gap-3 py-2">
                <img
                  src={url}
                  alt={`Property photo ${i + 1}`}
                  className="h-16 w-20 rounded object-cover"
                />
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    field(
                      "images",
                      row.images.filter((_, n) => n !== i),
                    )
                  }
                  className="underline"
                >
                  Remove photo
                </button>
              </div>
            ))}
            <input
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => setFiles(Array.from(e.target.files || []))}
            />
          </fieldset>
          <p className="text-sm text-slate-600">
            Edits do not reset the expiry or extend a paid plan. Changing the
            advertised phone removes its verified badge unless it matches your
            verified number.
          </p>
          {error ? (
            <p role="alert" className="text-red-700">
              {error}
            </p>
          ) : null}
          <button
            disabled={busy}
            className="rounded bg-[#005B94] px-4 py-2 text-white"
          >
            {busy ? "Saving…" : "Save changes"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="ml-4 underline"
          >
            Cancel
          </button>
        </form>
      </section>
    </div>
  );
}
