import type { Listing } from "@/lib/supabase";
import { ShieldCheck } from "lucide-react";

export function ListingVerificationStamp({ listing }: { listing: Listing }) {
  const checks = [
    listing.id_verified ? "Government ID verified" : null,
    listing.phone_verified ? "WhatsApp verified" : null,
    listing.email_verified ? "Email verified" : null,
  ].filter((value): value is string => value !== null);
  if (!checks.length) return <span className="inline-flex items-center gap-1.5 rounded-full border border-white/80 bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600 shadow-sm"><ShieldCheck aria-hidden="true" className="h-4 w-4"/>Not verified</span>;
  return <span
    title={`${checks.join(" · ")}. Verification does not confirm property ownership.`}
    className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-white/80 bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white shadow-md"
  ><ShieldCheck aria-hidden="true" className="h-4 w-4 shrink-0" />{checks[0]}</span>;
}
export function VerificationBadges({ listing }: { listing: Listing }) {
  const flags = [
    ["Email", !!listing.email_verified, "Confirmed ✓", "Not verified"],
    ["WhatsApp", !!listing.phone_verified, "Confirmed ✓", "Not verified"],
    ["Govt ID", !!listing.id_verified, "Verified ✓", "Not verified"],
  ] as const;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {listing.is_featured ? (
        <span className="rounded-full bg-amber-100 px-2 py-1 text-[11px] font-semibold text-amber-900">
          Featured
        </span>
      ) : null}
      {flags.map(([name, verified, positive, negative]) => (
        <span
          key={name}
          className={`rounded-full px-2 py-1 text-[11px] ${verified ? "bg-green-50 text-green-800" : "bg-slate-100 text-slate-600"}`}
        >
          {name}: {verified ? positive : negative}
        </span>
      ))}
    </div>
  );
}
