import { supabase } from "@/lib/supabase";
export const portalEnabled =
  process.env.NEXT_PUBLIC_PORTAL_V2_ENABLED === "true";
export async function portalCall(
  action: string,
  data: Record<string, unknown> = {},
) {
  const { data: auth } = await supabase.auth.getSession();
  const response = await fetch("/api/portal", {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...(auth.session
        ? { Authorization: `Bearer ${auth.session.access_token}` }
        : {}),
    },
    body: JSON.stringify({ action, ...data }),
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.error || "Unable to complete this request.");
  return result;
}
export async function portalDashboard(signal?: AbortSignal) {
  const { data: auth } = await supabase.auth.getSession();
  if (!auth.session) throw new Error("Please sign in.");
  const response = await fetch("/api/portal?scope=dashboard", {
    signal,
    cache: "no-store",
    headers: { Authorization: `Bearer ${auth.session.access_token}` },
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.error || "Unable to load dashboard.");
  return result;
}
export async function postingSession() {
  const { data } = await supabase.auth.getSession();
  if (data.session) return data.session;
  const result = await supabase.auth.signInAnonymously();
  if (result.error || !result.data.session)
    throw new Error(
      "Guest posting is unavailable. Please try again or sign in with email.",
    );
  return result.data.session;
}
