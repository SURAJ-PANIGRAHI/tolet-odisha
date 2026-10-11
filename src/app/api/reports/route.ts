import { consumeQuota, dispatchEmails, readInput, serverDb } from '@/lib/server/lifecycle';
export const runtime = 'nodejs';
const reasons = new Set(['fake', 'scam', 'wrong_contact', 'unavailable', 'misleading_photos', 'wrong_information', 'duplicate', 'other']);
export async function POST(request: Request) {
  let input;
  try { input = await readInput(request); } catch { return Response.json({ error: 'Invalid request' }, { status: 400 }); }
  const { listing_id: id, reason, description } = input;
  const note = typeof description === 'string' ? description.trim() : '';
  if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id) || typeof reason !== 'string' || !reasons.has(reason) || note.length > 1000 || (reason === 'other' && !note)) return Response.json({ error: 'Invalid report' }, { status: 400 });
  try {
    if (!await consumeQuota('reports-global', 100)) return Response.json({ error: 'Please try later' }, { status: 429 });
    const db = serverDb();
    const { error } = await db.rpc('submit_listing_report', { p_listing: id, p_reason: reason, p_description: note || null });
    if (error) throw error;
    // A send failure must not misrepresent a successfully saved report as unsaved.
    try { await dispatchEmails(1, id); } catch { /* Daily dispatcher retries the durable job. */ }
    return Response.json({ saved: true, notification: 'queued' });
  } catch { return Response.json({ error: 'Unable to save report. Please try again later.' }, { status: 503 }); }
}
