import { consumeQuota, dispatchEmails, readInput, serverDb } from '@/lib/server/lifecycle';
import { randomBytes, createHash } from 'node:crypto';
import { CATEGORIES, ODISHA_DISTRICTS, POPULAR_AMENITIES, COMMERCIAL_TYPES } from '@/data/odisha';
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
  if (!['Owner', 'Broker', 'Third Party'].includes(String(row.advertiser_type))) return Response.json({ error: 'Choose Owner, Broker or Third Party.' }, { status: 400 });
  const commercialType = row.commercial_type;
  const area = row.area_sqft;
  const isCommercial = row.category === 'Commercial / Shop';
  if ((area != null && (!Number.isInteger(area) || Number(area) <= 0 || Number(area) > 10000000)) ||
      (isCommercial && (typeof commercialType !== 'string' || !COMMERCIAL_TYPES.some(type => type === commercialType))) ||
      (!isCommercial && commercialType != null)) {
    return Response.json({ error: 'Choose a commercial type. Floor area is optional; if provided, enter a positive whole number in square feet.' }, { status: 400 });
  }
  try {
    if (!await consumeQuota('listings-global', 50)) return Response.json({ error: 'Please try again later.' }, { status: 429 });
    const managementKey = randomBytes(32).toString('hex');
    const { data, error } = await serverDb().rpc('submit_managed_listing', { p_listing: { ...row, contact_phone: phone, whatsapp_number: phone }, p_email: email || null, p_management_hash: createHash('sha256').update(managementKey).digest('hex') });
    if (error) throw error;
    try { await dispatchEmails(1, data); } catch { /* Durable job retries later. */ }
    return Response.json({ saved: true, management_path: `/manage?listing=${data}&key=${managementKey}` }, { headers: { 'Cache-Control': 'no-store' } });
  } catch { return Response.json({ error: 'Unable to submit your listing. Please try again later.' }, { status: 503 }); }
}
