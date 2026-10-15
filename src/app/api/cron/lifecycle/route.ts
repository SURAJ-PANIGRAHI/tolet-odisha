import { cleanupAccountIds } from '@/lib/server/account-id';
import { dispatchPortalEmails } from '@/lib/server/portal-email';
import { dispatchEmails, serverDb } from '@/lib/server/lifecycle';
import { timingSafeEqual } from 'node:crypto';
export const runtime = 'nodejs';
export const maxDuration = 60;
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const provided = Buffer.from(request.headers.get('authorization') || '');
  const expected = Buffer.from(`Bearer ${secret}`);
  if (!secret || provided.length !== expected.length || !timingSafeEqual(provided, expected)) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { error } = await serverDb().rpc('run_listing_lifecycle');
    if (error) throw error;
    const cleanup = await serverDb().rpc('account_prune_phone_verification');
    if (cleanup.error) throw cleanup.error;
    const idCleanup = await cleanupAccountIds(serverDb(), 5);
    const legacy = {...await dispatchEmails(5),idCleanup};
    if (process.env.NEXT_PUBLIC_PORTAL_V2_ENABLED !== 'true') return Response.json(legacy);
    const maintenance = await serverDb().rpc('portal_daily_maintenance');
    if (maintenance.error) throw maintenance.error;
    return Response.json({ legacy, portal: await dispatchPortalEmails(5) });
  } catch { return Response.json({ error: 'Lifecycle job failed' }, { status: 503 }); }
}
