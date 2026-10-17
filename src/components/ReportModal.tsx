'use client';

import { useEffect, useRef, useState } from 'react';
import { portalCall, postingSession } from '@/lib/client/portal';
import { type Listing } from '@/lib/supabase';

const reasons = [
  ['fake', 'Fake / Non-existent listing', 'ନକଲି ବିଜ୍ଞାପନ'],
  ['scam', 'Scam / Fraud attempt', 'ଠକେଇ ପ୍ରୟାସ'],
  ['wrong_contact', 'Wrong contact number', 'ଭୁଲ ଫୋନ୍ ନମ୍ବର'],
  ['unavailable', 'Already rented / Not available', 'ଭଡ଼ା ଦିଆସରିଛି / ଉପଲବ୍ଧ ନାହିଁ'],
  ['misleading_photos', 'Misleading photos', 'ଭ୍ରମାତ୍ମକ ଫଟୋ'],
  ['wrong_information', 'Wrong information', 'ଭୁଲ ତଥ୍ୟ'],
  ['duplicate', 'Duplicate listing', 'ଏକାଧିକ ସମାନ ବିଜ୍ଞାପନ'],
  ['other', 'Other', 'ଅନ୍ୟାନ୍ୟ'],
] as const;

export function ReportModal({ listing, onClose, isOdia }: { listing: Listing; onClose: () => void; isOdia: boolean }) {
  const [reason, setReason] = useState('fake');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const dialog = useRef<HTMLDivElement>(null);
  const submitLock = useRef(false);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const bodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.current?.focus();
    function keyboard(event: KeyboardEvent) {
      if (event.key === 'Escape' && !submitLock.current) onClose();
      if (event.key !== 'Tab') return;
      const elements = dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href]');
      if (!elements?.length) { event.preventDefault(); return; }
      const first = elements[0], last = elements[elements.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog.current)) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener('keydown', keyboard);
    return () => { document.body.style.overflow = bodyOverflow; document.removeEventListener('keydown', keyboard); previous?.focus(); };
  }, [onClose]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (submitLock.current || saved) return;
    submitLock.current = true; setBusy(true); setError('');
    try {
      if (listing.portal_listing) {
        await postingSession();
        const labels: Record<string, string> = { fake: 'Fake listing', scam: 'Scam / Fraud', wrong_contact: 'Wrong contact number', unavailable: 'Already rented', misleading_photos: 'Misleading photos', wrong_information: 'Wrong information', duplicate: 'Duplicate listing', other: 'Other' };
        await portalCall('report', { listing_id: listing.id, reason: labels[reason], description: note.trim() });
        setSaved(true); return;
      }
      const response = await fetch('/api/reports', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listing_id: listing.id, reason, description: note.trim() || null }),
      });
      if (!response.ok) throw new Error('Report failed');
      setSaved(true);
    } catch {
      setError(isOdia ? 'ରିପୋର୍ଟ ସଞ୍ଚୟ ହୋଇପାରିଲା ନାହିଁ। ପରେ ପୁଣି ଚେଷ୍ଟା କରନ୍ତୁ।' : 'Your report could not be saved. Please try again later.');
    } finally { submitLock.current = false; setBusy(false); }
  }

  return <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 p-4">
    <div ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="report-title" className="w-full max-w-lg max-h-[90vh] overflow-y-auto portal-dialog portal-form p-6 space-y-4">
      <div className="flex items-center justify-between gap-3"><h2 id="report-title" className="text-lg font-bold">{isOdia ? 'ବିଜ୍ଞାପନ ରିପୋର୍ଟ କରନ୍ତୁ' : 'Report this listing'}</h2><button type="button" disabled={busy} aria-label="Close report" onClick={onClose} className="rounded-xl border border-slate-200 px-3 py-2">✕</button></div>
      <p className="text-sm text-slate-600">{listing.title}{listing.listing_ref ? ` · ${listing.listing_ref}` : ''}</p>
      {saved ? <div role="status" className="space-y-3"><p>{isOdia ? 'ରିପୋର୍ଟ ସଞ୍ଚୟ ହୋଇଛି। ପ୍ରଶାସକ ସମୀକ୍ଷା କରିବେ।' : 'Thank you. Your report has been saved and a notification queued for review.'}</p></div> : <form onSubmit={submit} className="space-y-4">
        <label className="block text-sm font-semibold">{isOdia ? 'କାରଣ' : 'Reason'}<select value={reason} disabled={busy} onChange={event => setReason(event.target.value)} className="mt-1 block w-full rounded-xl border p-3">{reasons.map(item => <option key={item[0]} value={item[0]}>{isOdia ? item[2] : item[1]}</option>)}</select></label>
        <label className="block text-sm font-semibold">{isOdia ? 'ବିବରଣୀ' : `Details ${reason === 'other' ? '(required)' : '(optional)'}`}<textarea value={note} disabled={busy} required={reason === 'other'} maxLength={1000} rows={4} onChange={event => setNote(event.target.value)} className="mt-1 block w-full rounded-xl border p-3" /></label>
        <p className="text-xs text-slate-500">{isOdia ? 'ପାସୱାର୍ଡ କିମ୍ବା ବ୍ୟାଙ୍କ ତଥ୍ୟ ଲେଖନ୍ତୁ ନାହିଁ।' : 'Describe the issue without passwords, bank details or other sensitive information. Reports are visible only to administrators.'}</p>
        {error && <div role="alert" className="text-sm text-red-700">{error}</div>}
        <button type="submit" disabled={busy || (reason === 'other' && !note.trim())} className="rounded-lg bg-[#005B94] px-4 py-3 text-white disabled:opacity-50">{busy ? (isOdia ? 'ସଞ୍ଚୟ ହେଉଛି…' : 'Saving…') : (isOdia ? 'ରିପୋର୍ଟ ଦାଖଲ କରନ୍ତୁ' : 'Submit report')}</button>
      </form>}
    </div>
  </div>;
}
