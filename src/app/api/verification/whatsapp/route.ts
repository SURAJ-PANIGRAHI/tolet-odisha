import { portalUser } from '@/lib/server/portal-auth';
import { indianPhone, isUuid, readJsonLimited } from '@/lib/server/evolution';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const noStore = { 'Cache-Control': 'no-store' };
export async function POST(request: Request) {
  if (request.headers.get('origin') !== new URL(request.url).origin) return Response.json({ error: 'Invalid origin' }, { status: 403, headers: noStore });
  const businessNumber = process.env.WHATSAPP_BUSINESS_NUMBER;
  if (!businessNumber || !/^91[6-9]\d{9}$/.test(businessNumber) || !process.env.EVOLUTION_INSTANCE_NAME || (process.env.EVOLUTION_WEBHOOK_SECRET?.length || 0) < 32) return Response.json({ error: 'WhatsApp verification is not configured yet.' }, { status: 503, headers: noStore });
  try {
    const auth = await portalUser(request);
    if (!auth) return Response.json({ error: 'Start a guest session or sign in first.' }, { status: 401, headers: noStore });
    let input;
    try { input = await readJsonLimited(request, 1024) as { phone?: unknown }; }
    catch { return Response.json({ error: 'Invalid request.' }, { status: 400, headers: noStore }); }
    const phone = typeof input?.phone === 'string' ? indianPhone(input.phone) : null;
    if (!phone) return Response.json({ error: 'Enter a valid Indian mobile number.' }, { status: 400, headers: noStore });
    const { data, error } = await auth.db.rpc('account_create_phone_challenge', { p_actor: auth.user.id, p_phone: phone });
    if (error) {
      const rateLimited = error.message.includes('Try later');
      return Response.json({ error: rateLimited ? 'Too many attempts. Try again in an hour.' : 'Unable to start verification. Please try again.' }, { status: rateLimited ? 429 : 503, headers: noStore });
    }
    const challenge = data?.[0];
    if (!challenge) throw new Error('Missing challenge');
    return Response.json({ challenge_id: challenge.challenge_id, expires_at: challenge.valid_until,
      whatsapp_url: `https://wa.me/${businessNumber}?text=${encodeURIComponent(challenge.verification_text)}` }, { headers: noStore });
  } catch { return Response.json({ error: 'Verification service is temporarily unavailable.' }, { status: 503, headers: noStore }); }
}
export async function GET(request: Request) {
  try {
    const auth = await portalUser(request);
    if (!auth) return Response.json({ error: 'Please sign in again.' }, { status: 401, headers: noStore });
    const challenge = new URL(request.url).searchParams.get('challenge');
    if (challenge && !isUuid(challenge)) return Response.json({ error: 'Invalid challenge.' }, { status: 400, headers: noStore });
    const { data, error } = await auth.db.rpc('account_phone_verification_status', { p_actor: auth.user.id, p_challenge: challenge || null });
    if (error || !data?.[0]) throw new Error('Status unavailable');
    return Response.json(data[0], { headers: noStore });
  } catch { return Response.json({ error: 'Unable to check verification status.' }, { status: 503, headers: noStore }); }
}
