"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { GoogleIcon } from '@/components/BrandIcons';
import { SavedListings } from '@/components/SavedListings';
import { House, LayoutDashboard, Mail, ArrowRight, ShieldCheck, KeyRound, LogOut } from 'lucide-react';
import { PortalAccount } from "@/components/PortalAccount";
import { portalEnabled } from "@/lib/client/portal";
export default function Dashboard() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [googleAvailable, setGoogleAvailable] = useState<boolean | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`, {
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '' },
      signal: controller.signal,
      cache: 'no-store',
    }).then(async response => {
      if (!response.ok) throw new Error('Settings unavailable');
      const settings = await response.json();
      if (!controller.signal.aborted) setGoogleAvailable(settings.external?.google === true);
    }).catch(() => { if (!controller.signal.aborted) setGoogleAvailable(false); });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    let mounted = true;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, next) => {
      if (mounted) {
        setSession(next);
        setReady(true);
      }
    });
    supabase.auth.getSession().then(({ data, error }) => {
      if (mounted) {
        setSession(data.session);
        setReady(true);
        if (error)
          setMessage("Unable to restore your session. Please sign in again.");
      }
    }).catch(() => {
      if (mounted) { setReady(true); setMessage('Unable to restore your account. Your saved management links are still available below.'); }
    });
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);
  async function signIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const redirect = window.location.origin + "/dashboard";
      const { error } = session?.user.is_anonymous
        ? await supabase.auth.updateUser(
            { email: email.trim() },
            { emailRedirectTo: redirect },
          )
        : await supabase.auth.signInWithOtp({
            email: email.trim(),
            options: { emailRedirectTo: redirect },
          });
      setMessage(
        error ? error.message : "Check your inbox for your sign-in link.",
      );
    } catch {
      setMessage("Unable to send the sign-in link. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  async function google() {
    if (!googleAvailable || busy) return;
    setBusy(true);
    setMessage("");
    const options = { redirectTo: window.location.origin + "/dashboard" };
    try {
      const { error } = session?.user.is_anonymous
        ? await supabase.auth.linkIdentity({ provider: "google", options })
        : await supabase.auth.signInWithOAuth({ provider: "google", options });
      if (error) setMessage(error.message);
    } catch {
      setMessage("Google sign-in is unavailable. Please use an email link.");
    } finally { setBusy(false); }
  }
  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) setMessage("Unable to sign out. Please try again.");
  }
  const permanentAccount = !!session && !session.user.is_anonymous;
  return (
    <main className="min-h-screen bg-slate-50 pb-16">
      <header className="border-b border-slate-200 bg-white px-4 py-4"><div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3"><Link href="/" className="flex items-center gap-2.5"><span className="rounded-xl bg-[#005B94] p-2.5 text-white"><House size={21}/></span><span className="text-xl font-extrabold text-slate-900">ToLet<span className="text-[#005B94]">Odisha</span><span className="block text-xs font-medium text-slate-500">Pay Zero Commission</span></span></Link><Link href="/" className="rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-bold text-[#005B94]">Browse properties</Link></div></header>
      <div className="mx-auto max-w-5xl px-4 pt-8 sm:pt-12">
        <section className="relative overflow-hidden rounded-3xl bg-[#005B94] p-7 text-white sm:p-9"><div className="pointer-events-none absolute -right-10 -top-16 h-64 w-64 rounded-full border-[35px] border-white/5"/><span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold"><LayoutDashboard size={15}/> FOR PROPERTY ADVERTISERS</span><h1 className="mt-4 text-3xl font-extrabold sm:text-4xl">Manage My Listings</h1><p className="mt-3 max-w-xl text-sm leading-7 text-sky-100 sm:text-base">Manage the properties you’ve posted and keep your advertiser profile up to date.</p></section>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sky-100 bg-white px-5 py-4"><div><h2 className="text-sm font-bold text-slate-800">Looking for a place to rent?</h2><p className="mt-1 text-sm text-slate-500">Explore properties and contact advertisers directly. No sign-in needed.</p></div><Link href="/" className="inline-flex shrink-0 items-center gap-2 rounded-full bg-sky-50 px-4 py-2.5 text-sm font-bold text-[#005B94]">Browse rentals <ArrowRight size={16}/></Link></div>
        {!ready ? <p role="status" className="py-8 text-slate-500">Loading your dashboard…</p> : <div className="mt-8 grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0 space-y-8">
            {session && portalEnabled ? <PortalAccount key={session.user.id}/> : null}
            <SavedListings hidePortal={!!session && portalEnabled}/>
          </div>
          <aside className="space-y-5">
            {permanentAccount ? <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex items-center gap-2 font-bold"><ShieldCheck className="text-[#005B94]" size={22}/> Your account</div><p className="mt-3 break-all text-sm text-slate-600">{session?.user.email}</p><p className="mt-3 text-sm font-semibold text-emerald-700">{session?.user.email_confirmed_at ? 'Email Verified ✓' : 'Email verification pending'}</p>{!portalEnabled ? <p className="mt-3 text-sm leading-6 text-slate-500">Listings saved on this browser are shown here. Signing in does not automatically attach older guest listings; keep their private management links.</p> : null}<button onClick={() => void signOut()} className="mt-5 inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600"><LogOut size={16}/> Sign out</button></section> : <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <span className="inline-flex rounded-xl bg-sky-50 p-3 text-[#005B94]"><KeyRound size={24}/></span><h2 className="mt-4 text-xl font-bold">Your advertiser account</h2><p className="mt-2 text-sm leading-6 text-slate-500">{portalEnabled ? 'Sign in to manage your account across devices. Guest listings remain accessible with their private links.' : 'Sign in to build your profile. Your saved guest listings are available here without signing in.'}</p>
              <button type="button" disabled={busy || googleAvailable !== true} onClick={() => void google()} className="mt-5 flex min-h-12 w-full items-center justify-center gap-3 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"><GoogleIcon/> Continue with Google</button>
              <div className="my-5 flex items-center gap-3 text-xs text-slate-400"><span className="h-px flex-1 bg-slate-200"/>or use any email address<span className="h-px flex-1 bg-slate-200"/></div>
              <form onSubmit={signIn} className="space-y-3"><label htmlFor="dashboard-email" className="block text-sm font-semibold text-slate-700">Email address</label><div className="relative"><Mail className="pointer-events-none absolute left-3 top-3.5 text-slate-400" size={18}/><input id="dashboard-email" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required className="w-full rounded-xl border border-slate-200 py-3 pl-10 pr-3 text-sm outline-none focus:border-[#005B94] focus:ring-2 focus:ring-sky-100"/></div><button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#005B94] px-4 py-3 text-sm font-bold text-white hover:bg-[#004A7C] disabled:opacity-50">{busy ? 'Sending…' : 'Email me a sign-in link'}<ArrowRight size={17}/></button></form><p className="mt-4 text-center text-xs text-slate-400">No password to remember. No Google account required.</p>
            </section>}
            {message ? <p role="status" className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-[#005B94]">{message}</p> : null}
            <div id="profile-verification" className="scroll-mt-8 rounded-2xl bg-sky-50 p-5"><h3 className="flex items-center gap-2 text-sm font-bold text-[#005B94]"><ShieldCheck size={19}/> Help renters know who they’re contacting</h3><p className="mt-2 text-sm leading-6 text-slate-600">Build trust with badges for the details you verify. You can post first and complete verification later.</p><ul className="mt-4 space-y-3 text-sm text-slate-600"><li className="flex items-start gap-3"><Mail size={17} className="mt-0.5 shrink-0 text-[#005B94]"/><span><strong className="block text-slate-800">Email</strong>A confirmed way to reach you.</span></li><li className="flex items-start gap-3"><ShieldCheck size={17} className="mt-0.5 shrink-0 text-[#005B94]"/><span><strong className="block text-slate-800">WhatsApp & government ID</strong>Separate badges show which checks are complete.</span></li></ul><p className="mt-4 border-t border-sky-100 pt-3 text-xs leading-5 text-slate-500">Badges describe completed checks, not a guarantee about a property.</p></div>
          </aside>
        </div>}
      </div>
    </main>
  );
}
