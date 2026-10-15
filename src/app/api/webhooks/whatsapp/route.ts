import { serverDb } from '@/lib/server/lifecycle';
import { parseEvolutionMessages, readJsonLimited, secretMatches } from '@/lib/server/evolution';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  const instance = process.env.EVOLUTION_INSTANCE_NAME;
  const secret = process.env.EVOLUTION_WEBHOOK_SECRET;
  if (!instance || !secret || secret.length < 32) return Response.json({ error: 'Webhook not configured' }, { status: 503 });
  if (!secretMatches(request.headers.get('x-evolution-webhook-secret'), secret)) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  let messages;
  try { messages = parseEvolutionMessages(await readJsonLimited(request, 65536), instance); }
  catch { return Response.json({ error: 'Invalid webhook payload' }, { status: 400 }); }
  if (!messages.length) return Response.json({ received: true });
  try {
    const db = serverDb();
    for (const message of messages) {
      const { error } = await db.rpc('account_accept_whatsapp_verification', {
        p_actor: message.actor, p_nonce: message.nonce, p_sender: message.phone,
        p_instance: instance, p_message_id: message.messageId, p_sent_at: message.sentAt,
      });
      // Invalid/expired challenges return an ignored result. Real DB errors must retry.
      if (error) throw new Error('Verification storage unavailable');
    }
    return Response.json({ received: true });
  } catch {
    // No payloads, phone numbers, provider API keys or challenges in logs/responses.
    return Response.json({ error: 'Temporary verification failure' }, { status: 503 });
  }
}
