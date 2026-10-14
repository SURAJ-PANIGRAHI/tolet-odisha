"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { WhatsAppVerification } from "@/components/WhatsAppVerification";
import { PortalAccount } from "@/components/PortalAccount";
import { portalEnabled } from "@/lib/client/portal";
export default function Dashboard() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
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
    setMessage("");
    const options = { redirectTo: window.location.origin + "/dashboard" };
    try {
      const { error } = session?.user.is_anonymous
        ? await supabase.auth.linkIdentity({ provider: "google", options })
        : await supabase.auth.signInWithOAuth({ provider: "google", options });
      if (error) setMessage(error.message);
    } catch {
      setMessage("Google sign-in is unavailable. Please use an email link.");
    }
  }
  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) setMessage("Unable to sign out. Please try again.");
  }
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-3xl space-y-6">
        <Link href="/" className="text-[#005B94] underline">
          ← ToLet Odisha
        </Link>
        <h1 className="text-3xl font-bold">My Dashboard</h1>
        {!ready ? (
          <p role="status">Loading account…</p>
        ) : session && !session.user.is_anonymous ? (
          <>
            <div className="flex items-center justify-between gap-4 rounded-xl bg-white p-4">
              <p className="break-all">{session.user.email}</p>
              <button
                type="button"
                onClick={signOut}
                className="shrink-0 underline"
              >
                Sign out
              </button>
            </div>
            {session.user.email_confirmed_at && !session.user.is_anonymous ? (
              <>
                <p className="text-green-700">Email Verified ✅</p>
                {portalEnabled ? (
                  <PortalAccount key={session.user.id} />
                ) : (
                  <WhatsAppVerification key={session.user.id} />
                )}
              </>
            ) : (
              <p>Verify your email before verifying your phone.</p>
            )}
          </>
        ) : (
          <form
            onSubmit={signIn}
            className="rounded-2xl bg-white p-6 space-y-4"
          >
            <p>
              {session?.user.is_anonymous
                ? "You are using a guest session. Add email or Google sign-in to access your properties on other devices."
                : "Sign in with an email link or Google to manage your properties."}
            </p>
            <label htmlFor="dashboard-email" className="block font-medium">
              Email address
            </label>
            <input
              id="dashboard-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-lg border border-slate-300 p-3"
            />
            <button
              disabled={busy}
              className="rounded-lg bg-[#005B94] px-4 py-3 text-white disabled:opacity-50"
            >
              {busy ? "Sending…" : "Email me a sign-in link"}
            </button>
          </form>
        )}
        {ready && (!session || session.user.is_anonymous) ? (
          <>
            <button
              type="button"
              onClick={() => void google()}
              className="rounded border bg-white px-4 py-3"
            >
              Continue with Google
            </button>
            {session?.user.is_anonymous && portalEnabled ? (
              <PortalAccount key={session.user.id} />
            ) : null}
          </>
        ) : null}
        {message ? <p role="status">{message}</p> : null}
      </div>
    </main>
  );
}
