'use client';
import { useState } from 'react';
import { portalCall } from '@/lib/client/portal';
export default function RenewalForm({ token, portal = false }: { token: string; portal?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [message, setMessage] = useState('');
  async function submit(action: 'verify' | 'renew') {
    if (busy || done) return;
    setBusy(true);
    try {
      if (portal) { await portalCall('redeem', { token }); setDone(true); setMessage('Your listing has been renewed for another 30 days.'); return; }
      const response = await fetch('/api/renew', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, action }) });
      const result = await response.json();
      setMessage(result.message || result.error);
      if (response.ok) setDone(true);
    } catch { setMessage('Unable to connect. Please retry.'); }
    finally { setBusy(false); }
  }
  if (!token) return <p>This link is missing. Please use the link in your email.</p>;
  return <div className="space-y-4"><p>{portal ? 'If your accommodation is still available, renew it free for another 30 days.' : 'Confirm your email after posting. If your accommodation is still available, renew it for another 30 days.'} Opening this page alone does not renew your listing.</p><div className="flex flex-wrap gap-3">{!portal ? <button disabled={busy || done} onClick={() => void submit('verify')} className="rounded-xl border border-slate-200 px-4 py-3 font-semibold disabled:opacity-50">Confirm email</button> : null}<button disabled={busy || done} onClick={() => void submit('renew')} className="rounded-xl bg-[#005B94] px-4 py-3 font-semibold text-white disabled:opacity-50">Still available — Renew for 30 days</button></div><p role="status">{busy ? 'Processing…' : message}</p></div>;
}
