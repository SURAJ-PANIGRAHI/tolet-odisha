// Deploy with --no-verify-jwt; this machine-only endpoint authenticates x-cron-secret.
// Set PORTAL_CLEANUP_SECRET to the same random secret stored in Supabase Vault.
import { createClient } from 'npm:@supabase/supabase-js@2.117.3';

function matchesSecret(actual: string, expected: string): boolean {
  const a = new TextEncoder().encode(actual);
  const b = new TextEncoder().encode(expected);
  let difference = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) difference |= (a[i] || 0) ^ (b[i] || 0);
  return difference === 0;
}
Deno.serve(async (request: Request) => {
  const expected = Deno.env.get('PORTAL_CLEANUP_SECRET');
  const supplied = request.headers.get('x-cron-secret') || '';
  if (request.method !== 'POST' || !expected || expected.length < 32 || supplied.length > 512 || !matchesSecret(supplied, expected)) {
    return new Response('Unauthorized', { status: 401 });
  }
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return new Response('Worker not configured', { status: 503 });
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: jobs, error } = await db.rpc('portal_claim_id_cleanup', { p_limit: 20 });
  if (error) return new Response('Unable to claim jobs', { status: 503 });
  let deleted = 0, failed = 0;
  for (const job of jobs || []) {
    // The DB supplies only the fixed private bucket's registered object keys.
    let removed = false;
    try {
      const { error: removeError } = await db.storage.from('portal-government-ids').remove([job.object_path]);
      removed = !removeError;
    } catch { /* A timeout is uncertain: retain lease state and retry idempotently. */ }
    try {
      const { error: finishError } = await db.rpc('portal_finish_id_cleanup', {
        p_job: job.id, p_claim: job.claim_token, p_success: removed,
      });
      if (!removed || finishError) failed++; else deleted++;
    } catch { failed++; }

  }
  // No document paths, user IDs, secrets or signed URLs in responses/logs.
  return Response.json({ deleted, failed }, { status: failed ? 503 : 200 });
});
