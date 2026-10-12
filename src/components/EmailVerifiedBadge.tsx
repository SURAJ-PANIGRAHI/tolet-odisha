import { CheckCircle2 } from 'lucide-react';
export function EmailVerifiedBadge({ verified, isOdia }: { verified?: boolean; isOdia: boolean }) {
  if (verified !== true) return null;
  return <span title="Email address confirmed. Phone number and property details are not verified." className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-800"><CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5" />{isOdia ? 'ଇମେଲ୍ ନିଶ୍ଚିତ' : 'Email verified'}</span>;
}
