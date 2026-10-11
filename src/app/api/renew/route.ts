import { consumeQuota, readInput, serverDb, verifyRenewalToken } from '@/lib/server/lifecycle';
export async function POST(request: Request) {
  let input;
  try { input = await readInput(request); } catch { return Response.json({ error: 'Invalid request' }, { status: 400 }); }
  if (typeof input.token !== 'string' || !['verify', 'renew'].includes(String(input.action))) return Response.json({ error: 'Invalid request' }, { status: 400 });
  try {
    const token = verifyRenewalToken(input.token);
    if (!await consumeQuota('renew-global', 500)) return Response.json({ error: 'Please try later' }, { status: 429 });
    const { data, error } = await serverDb().rpc('confirm_listing_owner', { p_listing: token.id, p_cycle: token.cycle, p_renew: input.action === 'renew' });
    if (error || data !== true) return Response.json({ error: 'This link is no longer valid or this listing cannot be renewed.' }, { status: 400 });
    return Response.json({ message: input.action === 'renew' ? 'Your listing has been renewed for 30 days.' : 'Your email is verified. Your listing still requires administrator approval.' });
  } catch { return Response.json({ error: 'Unable to process this link. It may have expired.' }, { status: 400 }); }
}
