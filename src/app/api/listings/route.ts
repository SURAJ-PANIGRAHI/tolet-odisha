import { consumeQuota, dispatchEmails, readInput, serverDb } from '@/lib/server/lifecycle';
import { indianPhone, phoneAuth } from '@/lib/server/phone';
import { randomBytes, createHash } from 'node:crypto';
import { CATEGORIES, ODISHA_DISTRICTS, POPULAR_AMENITIES } from '@/data/odisha';
export async function POST(request: Request) {
  let input;
  try { input = await readInput(request); } catch { return Response.json({ error: 'Invalid request' }, { status: 400 }); }
  const row = input.listing as Record<string, unknown> | undefined;
  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
  const required = ['title', 'district', 'locality', 'contact_name', 'contact_phone'];
  if (input.email != null && typeof input.email !== 'string') return Response.json({ error: 'Please enter a valid email or leave it blank.' }, { status: 400 });
  if (email && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)) return Response.json({ error: 'Please enter a valid email or leave it blank.' }, { status: 400 });
  if (!row || required.some(key => typeof row[key] !== 'string' || !String(row[key]).trim() || String(row[key]).length > 200)) return Response.json({ error: 'Please complete the required fields.' }, { status: 400 });
  const phone = String(row.contact_phone).replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '');
  const images = row.images;
  const amenities = row.amenities;
  const prefix = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/listing-images/listings/`;
  if (!/^[6-9]\d{9}$/.test(phone) || !CATEGORIES.some(c => c.id !== 'All' && c.id === row.category) || !ODISHA_DISTRICTS.some(d => d.split(' ')[0] === row.district) || !Number.isInteger(row.rent_monthly) || Number(row.rent_monthly) < 0 || Number(row.rent_monthly) > 10000000 || !Number.isInteger(row.deposit) || Number(row.deposit) < 0 || Number(row.deposit) > 10000000 || !Array.isArray(images) || images.length > 10 || images.some(url => typeof url !== 'string' || !url.startsWith(prefix) || url.length > 1000) || !Array.isArray(amenities) || amenities.length > POPULAR_AMENITIES.length || amenities.some(a => !POPULAR_AMENITIES.includes(a)) || String(row.description || '').length > 5000 || String(row.landmark || '').length > 200) return Response.json({ error: 'Please check your listing information.' }, { status: 400 });
  let verifiedUser: string | null = null;
  let verifiedPhone: string | null = null;
  if (process.env.NEXT_PUBLIC_PHONE_OTP_ENABLED === 'true') {
    const authorization = request.headers.get('authorization') || '';
    if (!authorization.startsWith('Bearer ') || authorization.length > 10000) return Response.json({ error: 'Verify your mobile number before posting.' }, { status: 401 });
    try {
      const { data, error } = await phoneAuth().auth.getUser(authorization.slice(7));
      if (error || !data.user?.phone_confirmed_at || indianPhone(data.user.phone) !== `+91${phone}`) return Response.json({ error: 'Verify the same mobile number used in your listing.' }, { status: 401 });
      verifiedUser = data.user.id;
      verifiedPhone = indianPhone(data.user.phone);
    } catch { return Response.json({ error: 'Phone verification failed. Please verify again.' }, { status: 401 }); }
  }
  try {
    if (!await consumeQuota('listings-global', 50)) return Response.json({ error: 'Please try again later.' }, { status: 429 });
    const managementKey = randomBytes(32).toString('hex');
    const { data, error } = await serverDb().rpc(verifiedUser ? 'submit_phone_verified_listing' : 'submit_managed_listing', { p_listing: { ...row, contact_phone: phone, whatsapp_number: phone }, p_email: email || null, p_management_hash: createHash('sha256').update(managementKey).digest('hex'), ...(verifiedUser ? { p_user: verifiedUser, p_verified_phone: verifiedPhone } : {}) });
    if (error) throw error;
    try { await dispatchEmails(1, data); } catch { /* Durable job retries later. */ }
    return Response.json({ saved: true, management_path: `/manage?listing=${data}&key=${managementKey}` }, { headers: { 'Cache-Control': 'no-store' } });
  } catch { return Response.json({ error: 'Unable to submit your listing. Please try again later.' }, { status: 503 }); }
}
