import type { Listing } from "@/lib/supabase";
export function VerificationBadges({ listing }: { listing: Listing }) {
  const flags = [
    ["Email", !!listing.email_verified],
    ["WhatsApp", !!listing.phone_verified],
    ["ID", !!listing.id_verified],
  ] as const;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {listing.is_featured ? (
        <span className="rounded-full bg-amber-100 px-2 py-1 text-[11px] font-semibold text-amber-900">
          Featured
        </span>
      ) : null}
      {flags.map(([name, verified]) => (
        <span
          key={name}
          className={`rounded-full px-2 py-1 text-[11px] ${verified ? "bg-green-50 text-green-800" : "bg-slate-100 text-slate-600"}`}
        >
          {name}: {verified ? "Verified ✓" : "Not verified"}
        </span>
      ))}
    </div>
  );
}
