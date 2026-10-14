'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useBrowserLocation } from '@/lib/client/use-browser-location';
import { managementPath, saveListing, savedListings } from '@/lib/client/saved-listings';
export default function ManagementForm({ listing, managementKey }: { listing: string; managementKey: string }) {
  const href = useBrowserLocation();
  const privateKey = managementKey || (href ? new URLSearchParams(new URL(href).hash.slice(1)).get('key') || '' : '');
  useEffect(() => {
    const key = managementKey || new URLSearchParams(window.location.hash.slice(1)).get('key') || '';
    const path = managementPath(`/manage?listing=${listing}#key=${key}`);
    if (path) {
      const existing = savedListings().find(row => row.id === listing);
      saveListing(existing || { id: listing, path, title: 'Saved property', locality: 'Managed through your private link', rent: 0, savedAt: new Date().toISOString() });
      if (managementKey) window.history.replaceState(null, '', path);
    }
  }, [listing, managementKey]);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [removed, setRemoved] = useState(false);
  const [message, setMessage] = useState('');
  const submitting = useRef(false);
  async function remove() {
    if (!confirmed || submitting.current || removed) return;
    submitting.current = true;
    setBusy(true);
    try {
      const response = await fetch('/api/manage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ listing, key: privateKey }) });
      const result = await response.json();
      if (response.ok) { setRemoved(true); setMessage('Your listing has been removed from the website.'); }
      else setMessage(result.error || 'Unable to remove listing.');
    } catch { setMessage('Unable to connect. Please retry.'); }
    finally { submitting.current = false; setBusy(false); }
  }
  if (!href) return <p role="status">Loading management link…</p>;
  if (!listing || !privateKey) return <p>Use the private management link saved after posting your listing.</p>;
  return <div className="space-y-4"><Link href="/dashboard" className="inline-flex rounded-full bg-sky-50 px-4 py-2 text-sm font-bold text-[#005B94]">← Manage My Listings</Link><p>You can take your ad down at any time. Opening this page alone does not remove it.</p>{!removed && <><label className="flex gap-3 items-start"><input type="checkbox" checked={confirmed} disabled={busy} onChange={event => setConfirmed(event.target.checked)} /><span>I want to remove this listing. It will no longer be available for renewal.</span></label><button disabled={!confirmed || busy} onClick={() => void remove()} className="rounded bg-red-700 px-5 py-3 text-white disabled:opacity-50">{busy ? 'Removing…' : 'Remove my listing'}</button></>}<p role="status">{message}</p></div>;
}
