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
    return Response.json(await dispatchEmails(5));
  } catch { return Response.json({ error: 'Lifecycle job failed' }, { status: 503 }); }
}
