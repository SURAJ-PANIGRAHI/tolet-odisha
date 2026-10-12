import { createHash } from 'node:crypto';
import { consumeQuota, readInput, serverDb } from '@/lib/server/lifecycle';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  let input;
  try { input = await readInput(request); } catch { return Response.json({ error: 'Invalid request' }, { status: 400 }); }
  if (typeof input.listing !== 'string' || !/^[0-9a-f-]{36}$/i.test(input.listing) || typeof input.key !== 'string' || !/^[0-9a-f]{64}$/.test(input.key)) return Response.json({ error: 'Invalid management link' }, { status: 400 });
  try {
    if (!await consumeQuota('management-global', 500)) return Response.json({ error: 'Please try later' }, { status: 429 });
    const { data, error } = await serverDb().rpc('remove_owned_listing', { p_listing: input.listing, p_management_hash: createHash('sha256').update(input.key).digest('hex') });
    if (error) throw error;
    if (data !== true) return Response.json({ error: 'Invalid management link' }, { status: 403 });
    return Response.json({ removed: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch { return Response.json({ error: 'Unable to remove listing. Please retry.' }, { status: 503 }); }
}
