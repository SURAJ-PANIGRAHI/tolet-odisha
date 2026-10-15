'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type Challenge = { challenge_id: string; expires_at: string; whatsapp_url: string };
type Status = { verified: boolean; phone_number: string | null; challenge_status: string };
async function verificationRequest(method: 'GET' | 'POST', signal?: AbortSignal, phone?: string, challenge?: string) {
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error('Please sign in again.');
  const response = await fetch('/api/verification/whatsapp' + (challenge ? '?challenge=' + encodeURIComponent(challenge) : ''), {
    method, signal, cache: 'no-store', headers: { Authorization: `Bearer ${data.session.access_token}`, ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}) },
    ...(method === 'POST' ? { body: JSON.stringify({ phone }) } : {}),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Unable to check verification.');
  return result;
}
export function WhatsAppVerification() {
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState<Status | null>(null);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [busy, setBusy] = useState(false);
  const [changing, setChanging] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        if (challenge && Date.parse(challenge.expires_at) <= Date.now()) {
          setChallenge(null); setError('The verification link expired. Please start again.'); return;
        }
        const result: Status = await verificationRequest('GET', controller.signal, undefined, challenge?.challenge_id);
        if (controller.signal.aborted) return;
        setStatus(result); setError('');
        if (result.verified) { setChallenge(null); return; }
        if (challenge && result.challenge_status !== 'pending') {
          setChallenge(null); setError('This verification link is no longer active. Please start again.'); return;
        }
        if (challenge) timer = setTimeout(poll, 3000);
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Unable to check verification.');
      }
    }
    void poll();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [challenge, retry]);
  async function start() {
    setBusy(true); setError('');
    try { const next = await verificationRequest('POST', undefined, phone); setStatus(null); setChanging(false); setChallenge(next); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to start verification.'); }
    finally { setBusy(false); }
  }
  return <section className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
    <h2 className="text-xl font-bold">WhatsApp phone verification</h2>
    <p className="text-slate-600">Send a verification message from your own WhatsApp number. Verification adds trust to your profile. It confirms control of your number, not property ownership. Only listings with the same contact number receive the WhatsApp badge.</p>
    {status?.verified && !changing ? <div><p role="status" className="font-semibold text-green-700">WhatsApp confirmed ✓ {status.phone_number}</p><button type="button" onClick={() => setChanging(true)} className="mt-3 text-sm underline">Change verified number</button></div> : <>
      <label className="block font-medium" htmlFor="verification-phone">Your Indian mobile number</label>
      <input id="verification-phone" type="tel" autoComplete="tel" inputMode="tel" value={phone} onChange={e => setPhone(e.target.value)} disabled={busy || !!challenge} placeholder="9876543210" className="w-full rounded-lg border border-slate-300 p-3" />
      {!challenge ? <button type="button" disabled={busy || !phone.trim()} onClick={start} className="rounded-lg bg-[#005B94] px-4 py-3 text-white disabled:opacity-50">{busy ? 'Preparing verification…' : 'Verify Phone via WhatsApp'}</button> : <>
        <p role="status">Waiting for WhatsApp confirmation...</p>
        <a href={challenge.whatsapp_url} target="_blank" rel="noopener noreferrer" className="inline-block rounded-lg bg-green-700 px-4 py-3 text-white">Open WhatsApp and send the message</a>
        <p className="text-sm text-slate-600">Opening WhatsApp alone does not verify your number. Send the message without editing it, then return here. The link expires after 30 minutes.</p>
        <button type="button" onClick={() => { setChallenge(null); setError(''); }} className="block underline">Use another number</button>
      </>}
    </>}
    {error ? <div role="alert" className="text-red-700"><p>{error}</p><button type="button" onClick={() => setRetry(r => r + 1)} className="underline">Check status again</button></div> : null}
  </section>;
}
