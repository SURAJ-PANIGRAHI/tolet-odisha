import { createHash } from 'node:crypto';
import { consumeQuota, readInput } from '@/lib/server/lifecycle';
import { indianPhone, phoneAuth } from '@/lib/server/phone';
export async function POST(request: Request) {
  if (process.env.NEXT_PUBLIC_PHONE_OTP_ENABLED !== 'true') return Response.json({ error: 'Phone verification is not available yet.' }, { status: 503 });
  let input;
  try { input = await readInput(request); } catch { return Response.json({ error: 'Invalid request' }, { status: 400 }); }
  const phone = indianPhone(input.phone);
  if (!phone || typeof input.code !== 'string' || !/^\d{6}$/.test(input.code)) return Response.json({ error: 'Enter the six-digit OTP.' }, { status: 400 });
  try {
    const scope = createHash('sha256').update(phone).digest('hex');
    if (!await consumeQuota(`otp-attempt:${scope}`, 10)) return Response.json({ error: 'Too many attempts. Please try later.' }, { status: 429 });
    const { data, error } = await phoneAuth().auth.verifyOtp({ phone, token: input.code, type: 'sms' });
    if (error || !data.session || !data.user?.phone_confirmed_at || indianPhone(data.user.phone) !== phone) return Response.json({ error: 'The OTP is incorrect or expired.' }, { status: 400 });
    return Response.json({ verified: true, access_token: data.session.access_token }, { headers: { 'Cache-Control': 'no-store' } });
  } catch { return Response.json({ error: 'Unable to verify the OTP. Please retry.' }, { status: 503 }); }
}
