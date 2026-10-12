import { createHash } from 'node:crypto';
import { consumeQuota, readInput } from '@/lib/server/lifecycle';
import { indianPhone, phoneAuth } from '@/lib/server/phone';
export async function POST(request: Request) {
  if (process.env.NEXT_PUBLIC_PHONE_OTP_ENABLED !== 'true') return Response.json({ error: 'Phone verification is not available yet.' }, { status: 503 });
  let input;
  try { input = await readInput(request); } catch { return Response.json({ error: 'Invalid request' }, { status: 400 }); }
  const phone = indianPhone(input.phone);
  if (!phone) return Response.json({ error: 'Enter a valid Indian mobile number.' }, { status: 400 });
  try {
    const scope = createHash('sha256').update(phone).digest('hex');
    if (!await consumeQuota(`sms:${scope}`, 3) || !await consumeQuota('sms-global', 30)) return Response.json({ error: 'SMS limit reached. Please try later.' }, { status: 429 });
    const { error } = await phoneAuth().auth.signInWithOtp({ phone, options: { shouldCreateUser: true } });
    if (error) return Response.json({ error: 'Unable to send an OTP. Please wait and retry.' }, { status: 503 });
    return Response.json({ sent: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch { return Response.json({ error: 'Unable to send an OTP. Please retry later.' }, { status: 503 }); }
}
