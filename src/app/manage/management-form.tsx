'use client';
import { useRef, useState } from 'react';
export default function ManagementForm({ listing, managementKey }: { listing: string; managementKey: string }) {
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
      const response = await fetch('/api/manage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ listing, key: managementKey }) });
      const result = await response.json();
      if (response.ok) { setRemoved(true); setMessage('Your listing has been removed from the website.'); }
      else setMessage(result.error || 'Unable to remove listing.');
    } catch { setMessage('Unable to connect. Please retry.'); }
    finally { submitting.current = false; setBusy(false); }
  }
  if (!listing || !managementKey) return <p>Use the private management link saved after posting your listing.</p>;
  return <div className="space-y-4"><p>You can take your ad down at any time. Opening this page alone does not remove it.</p>{!removed && <><label className="flex gap-3 items-start"><input type="checkbox" checked={confirmed} disabled={busy} onChange={event => setConfirmed(event.target.checked)} /><span>I want to remove this listing. It will no longer be available for renewal.</span></label><button disabled={!confirmed || busy} onClick={() => void remove()} className="rounded bg-red-700 px-5 py-3 text-white disabled:opacity-50">{busy ? 'Removing…' : 'Remove my listing'}</button></>}<p role="status">{message}</p></div>;
}
