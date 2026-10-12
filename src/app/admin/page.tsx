'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createClient, type Session } from '@supabase/supabase-js';
import type { Listing } from '@/lib/supabase';

type ReviewListing = Listing & { moderation_status: 'pending' | 'approved' | 'rejected' };

// Keep the admin token separate from the public listing submission client.
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
  { auth: { storageKey: 'tolet-admin', persistSession: false, detectSessionInUrl: false } },
);

export default function AdminPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [reports, setReports] = useState<{ id: string; listing_id: string; reason: string; description: string | null; created_at: string }[]>([]);
  const [rows, setRows] = useState<ReviewListing[]>([]);
  const [filter, setFilter] = useState('approved');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const { data } = admin.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setRows([]);
      setReports([]);
      setAuthorized(false);
      setReady(true);
    });
    return () => { data.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!session) return;
    async function load() {
      setBusy(true);
      setMessage('');
      try {
        const membership = await admin.from('admin_users').select('user_id').eq('user_id', session!.user.id).maybeSingle();
        if (membership.error) throw membership.error;
        if (!membership.data) throw new Error('This account has no administrator access.');
        const result = await admin.from('listings').select('*').eq('moderation_status', filter).order('created_at', { ascending: false }).limit(100);
        if (result.error) throw result.error;
        if (!cancelled) { setAuthorized(true); setRows(result.data || []); }
        const reportResult = await admin.from('reports').select('id, listing_id, reason, description, created_at').order('created_at', { ascending: false }).limit(100);
        if (reportResult.error) throw new Error('Listing queue loaded, but reports could not be loaded. Check the reports migration.');
        if (!cancelled) setReports(reportResult.data || []);
      } catch (error) {
        if (!cancelled) setMessage(error instanceof Error ? error.message : 'Unable to load the review queue.');
      } finally { if (!cancelled) setBusy(false); }
    }
    void load();
    return () => { cancelled = true; };
  }, [session, filter]);

  async function login(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setMessage('');
    try {
      const { error } = await admin.auth.signInWithPassword({ email, password });
      if (error) throw error;
      setPassword('');
    } catch { setMessage('Sign-in failed. Check your administrator credentials.'); }
    finally { setBusy(false); }
  }

  async function moderate(row: ReviewListing, status: ReviewListing['moderation_status']) {
    setBusy(true); setMessage('');
    try {
      const { data, error } = await admin.from('listings')
        .update({ moderation_status: status, is_active: status === 'approved' })
        .eq('id', row.id).eq('moderation_status', row.moderation_status).select('id');
      if (error) throw error;
      if (data?.length !== 1) throw new Error('Listing changed or permission was revoked. Reload the queue.');
      setRows(previous => previous.filter(item => item.id !== row.id));
      setMessage(`Listing ${status}.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Action failed.'); }
    finally { setBusy(false); }
  }

  const button = 'rounded-lg bg-[#005B94] px-4 py-2 text-white disabled:opacity-50';
  return <main className="mx-auto max-w-4xl p-6 space-y-5">
    <h1 className="text-2xl font-bold">ToLet Odisha — Report moderation</h1>
    <Link href="/" className="text-[#005B94] underline">Back to listings</Link>
    {message && <p role="status" className="rounded-lg bg-slate-100 p-3">{message}</p>}
    {!ready ? <p>Loading…</p> : !session ? <form onSubmit={login} className="max-w-sm space-y-4">
      <label className="block">Administrator email<input className="block w-full rounded border p-2" type="email" autoComplete="username" required value={email} onChange={event => setEmail(event.target.value)} /></label>
      <label className="block">Password<input className="block w-full rounded border p-2" type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} /></label>
      <button className={button} disabled={busy}>Sign in</button>
    </form> : <>
      <div className="flex flex-wrap gap-4 items-center">
        <button className={button} onClick={() => void admin.auth.signOut()}>Sign out</button>
        <label>Queue <select className="rounded border p-2" value={filter} onChange={event => setFilter(event.target.value)}>
          <option value="pending">Pending</option><option value="approved">Published</option><option value="rejected">Rejected</option>
        </select></label>
      </div>
      {busy && <p role="status">Working…</p>}
      {authorized && !busy && rows.length === 0 && <p>No listings in this queue.</p>}
      {authorized && <p className="text-sm text-slate-600">Showing up to 100 listings in this category. Review reported listings below.</p>}
      {authorized && <section className="rounded-xl border border-amber-200 p-4 space-y-3">
        <h2 className="text-lg font-bold">Latest reports</h2>
        <p className="text-sm text-slate-600">Latest 100 reports. Match the listing ID below with a listing in the review queue.</p>
        {reports.map(report => <article key={report.id} className="border-t pt-3 text-sm">
          <p className="font-semibold">{report.reason.replaceAll('_', ' ')} · {new Date(report.created_at).toLocaleString()}</p>
          <p className="break-all">Listing ID: {report.listing_id}</p><p className="whitespace-pre-wrap">{report.description}</p>
        </article>)}
      </section>}
      {rows.map(row => <article key={row.id} className="rounded-xl border p-4 space-y-3">
        <h2 className="text-lg font-bold">{row.title}</h2><p className="text-xs text-slate-500 break-all">Listing ID: {row.id}</p>
        <p>{row.district} · {row.locality} · {row.category} · ₹{row.rent_monthly}/month</p>
        <p>{row.description}</p><p>{row.contact_name} · {row.contact_phone} · {row.landmark}</p>
        <div className="flex flex-wrap gap-2">{(row.images || []).map((url, index) => {
          const prefix = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/listing-images/`;
          return url.startsWith(prefix) ? <a key={index} href={url} target="_blank" rel="noopener noreferrer">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt={`Property photo ${index + 1}`} className="h-28 w-36 rounded object-cover" />
          </a> : <span key={index}>External photo omitted</span>;
        })}</div>
        <div className="flex gap-3">
          {row.moderation_status !== 'approved' && <button className={button} disabled={busy} onClick={() => void moderate(row, 'approved')}>Approve</button>}
          {row.moderation_status !== 'rejected' && <button className="rounded-lg border border-red-600 px-4 py-2 text-red-700 disabled:opacity-50" disabled={busy} onClick={() => void moderate(row, 'rejected')}>Reject / Unpublish</button>}
        </div>
      </article>)}
    </>}
  </main>;
}
