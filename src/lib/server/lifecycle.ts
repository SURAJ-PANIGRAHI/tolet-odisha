import 'server-only';
import {sendWhatsApp,whatsappDeliveryReady} from './whatsapp-delivery';
import { createClient } from '@supabase/supabase-js';
import { createHmac, timingSafeEqual } from 'node:crypto';

export function serverDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Server database is not configured');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function renewalToken(listingId: string, expiresAt: string) {
  const key = process.env.RENEWAL_SIGNING_SECRET;
  if (!key || key.length < 32) throw new Error('Renewal signing secret is not configured');
  const payload = Buffer.from(JSON.stringify({ id: listingId, cycle: expiresAt, exp: Date.parse(expiresAt) + 7 * 86400000 })).toString('base64url');
  return `${payload}.${createHmac('sha256', key).update(payload).digest('base64url')}`;
}

export function verifyRenewalToken(token: string) {
  const [payload, signature, extra] = token.split('.');
  const key = process.env.RENEWAL_SIGNING_SECRET;
  if (!key || !payload || !signature || extra || token.length > 1000) throw new Error('Invalid link');
  const expected = createHmac('sha256', key).update(payload).digest();
  const supplied = Buffer.from(signature, 'base64url');
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) throw new Error('Invalid link');
  const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString());
  if (typeof parsed.id !== 'string' || typeof parsed.cycle !== 'string' || typeof parsed.exp !== 'number' || parsed.exp <= Date.now()) throw new Error('Expired link');
  return parsed as { id: string; cycle: string; exp: number };
}

export async function readInput(request: Request): Promise<Record<string, unknown>> {
  const origin = request.headers.get('origin');
  if (!origin || origin !== new URL(request.url).origin) throw new Error('Invalid origin');
  const text = await request.text();
  if (text.length > 16000) throw new Error('Request too large');
  const input = JSON.parse(text);
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid request');
  return input;
}

export async function consumeQuota(scope: string, limit: number) {
  const db = serverDb();
  const { data, error } = await db.rpc('consume_submission_quota', { p_scope: scope, p_limit: limit });
  if (error) throw error;
  return data === true;
}

type Job = { id: string; kind: string; recipient: string; listing_id: string; cycle: string | null; subject: string; body: string };

// Durable jobs are claimed under a database lease. Failed sends remain retryable.
export async function dispatchEmails(limit = 20, listingId: string | null = null) {
  const emailReady=!!(process.env.RESEND_API_KEY&&process.env.EMAIL_FROM);
  if (!emailReady&&!whatsappDeliveryReady()) return { sent: 0, failed: 0, configured: false };
  const db = serverDb();
  const { data, error } = await db.rpc('claim_notification_jobs', { p_limit: limit, p_listing: listingId });
  if (error) throw error;
  let sent = 0, failed = 0;
  for (const job of (data || []) as Job[]) {
    try {
      let body = job.body;
      if(job.kind==='published_email'||job.kind==='published_whatsapp'){
        const {data:listing,error:listingError}=await db.from('listings').select('is_active,moderation_status,expires_at').eq('id',job.listing_id).maybeSingle();
        if(listingError)throw listingError;
        if(!listing||!listing.is_active||listing.moderation_status!=='approved'||Date.parse(listing.expires_at)<=Date.now()){
          const {error:cancelError}=await db.from('notification_jobs').update({sent_at:new Date().toISOString(),last_error:'Listing no longer live'}).eq('id',job.id);
          if(cancelError)throw cancelError;
          continue;
        }
      }
      if (job.kind === 'verify' || job.kind === 'renewal') {
        const { data: owner, error: ownerError } = await db.from('listing_owner_contacts').select('listing_id').eq('listing_id', job.listing_id).eq('cycle', job.cycle!).maybeSingle();
        if (ownerError) throw ownerError;
        if (!owner) {
          const { error: cancelError } = await db.from('notification_jobs').update({ sent_at: new Date().toISOString(), last_error: 'obsolete cycle' }).eq('id', job.id);
          if (cancelError) throw cancelError;
          continue;
        }
        const link = new URL('/renew', process.env.APP_URL!);
        link.searchParams.set('token', renewalToken(job.listing_id, job.cycle!));
        body += `\n\n${link.toString()}\n\nOpen the link and confirm your choice. If you do nothing, the listing will expire.`;
      }
      if(job.kind==='published_whatsapp'){
        await sendWhatsApp(job.recipient,job.body);
      }else{
      if(!emailReady)throw new Error('Email delivery unavailable');
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': `tolet-${job.id}` },
        body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [job.recipient], ...(job.kind === 'report' ? { cc: ['support@toletodisha.in'] } : {}), subject: job.subject, text: body }),
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw new Error(`Email provider status ${response.status}`);
      }
      const { error: markError } = await db.from('notification_jobs').update({ sent_at: new Date().toISOString(), last_error: null }).eq('id', job.id);
      if (markError) throw markError;
      sent++;
    } catch {
      failed++;
      const { error: retryError } = await db.from('notification_jobs').update({ available_at: new Date(Date.now() + 3600000).toISOString(), last_error: 'Delivery failed; retry pending' }).eq('id', job.id);
      if (retryError) throw retryError;
    }
  }
  return { sent, failed, configured: true };
}
