import { timingSafeEqual } from 'node:crypto';

type ObjectValue = Record<string, unknown>;
const object = (value: unknown): ObjectValue | null => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as ObjectValue : null;
const uuidPattern = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const verificationPattern = new RegExp(`^VERIFY_(${uuidPattern})_([0-9a-f]{64})$`, 'i');
export const isUuid = (value: string): boolean => new RegExp(`^${uuidPattern}$`, 'i').test(value);

export function secretMatches(supplied: string | null, expected: string | undefined): boolean {
  if (!expected || expected.length < 32 || !supplied || supplied.length > 512) return false;
  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function indianPhone(value: string): string | null {
  const digits = value.replace(/[\s()+-]/g, '').replace(/^91(?=[6-9]\d{9}$)/, '');
  return /^[6-9]\d{9}$/.test(digits) ? `+91${digits}` : null;
}
function phoneFromJid(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  // Never interpret WhatsApp privacy LIDs or group IDs as real phone numbers.
  const match = value.match(/^(91[6-9]\d{9})(?::\d+)?@(s\.whatsapp\.net|c\.us)$/);
  return match ? `+${match[1]}` : null;
}
function messageText(message: unknown): string | null {
  const m = object(message);
  if (!m) return null;
  if (typeof m.conversation === 'string') return m.conversation;
  const text = object(m.extendedTextMessage)?.text;
  if (typeof text === 'string') return text;
  // Only unwrap the actual message; never read quotedMessage, captions or reactions.
  const ephemeral = object(m.ephemeralMessage);
  if (ephemeral) {
    const nested = object(ephemeral.message);
    if (typeof nested?.conversation === 'string') return nested.conversation;
    const nestedText = object(nested?.extendedTextMessage)?.text;
    if (typeof nestedText === 'string') return nestedText;
  }
  return null;
}
export interface VerificationMessage {
  actor: string; nonce: string; phone: string; messageId: string; sentAt: string | null;
}
export function parseEvolutionMessages(payload: unknown, expectedInstance: string): VerificationMessage[] {
  const root = object(payload);
  if (!root || root.instance !== expectedInstance || typeof root.event !== 'string' || root.event.toLowerCase().replaceAll('_', '.') !== 'messages.upsert') return [];
  const data = Array.isArray(root.data) ? root.data : [root.data];
  if (data.length > 100) throw new Error('Too many webhook messages');
  const result: VerificationMessage[] = [];
  for (const entry of data) {
    const item = object(entry);
    const key = object(item?.key);
    if (!item || !key || key.fromMe !== false || typeof key.id !== 'string' || key.id.length < 1 || key.id.length > 200) continue;
    if (typeof key.remoteJid !== 'string' || !/@(s\.whatsapp\.net|c\.us|lid)$/.test(key.remoteJid)) continue;
    const candidates = [key.remoteJid, key.remoteJidAlt, key.senderPn, item.senderPn];
    const phones = [...new Set(candidates.map(phoneFromJid).filter((p): p is string => !!p))];
    if (phones.length !== 1) continue; // Ambiguous identity: fail closed.
    // root.sender is the connected BUSINESS account in Evolution's webhook envelope.
    const text = messageText(item.message)?.trim();
    const match = text && verificationPattern.exec(text);
    if (!match) continue;
    const timestamp = typeof item.messageTimestamp === 'number' ? item.messageTimestamp : typeof item.messageTimestamp === 'string' ? Number(item.messageTimestamp) : null;
    if (timestamp !== null && (!Number.isFinite(timestamp) || timestamp <= 0 || timestamp > 8640000000000)) continue;
    result.push({ actor: match[1].toLowerCase(), nonce: match[2].toLowerCase(), phone: phones[0], messageId: key.id,
      sentAt: timestamp === null ? null : new Date(timestamp * 1000).toISOString() });
  }
  return result;
}
export async function readJsonLimited(request: Request, limit: number): Promise<unknown> {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) throw new Error('JSON required');
  const declared = request.headers.get('content-length');
  if (declared && Number(declared) > limit) throw new Error('Request too large');
  if (!request.body) throw new Error('Empty request');
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = []; let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > limit) { await reader.cancel(); throw new Error('Request too large'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

export interface SupportMessage{phone:string;messageId:string;text:string;sentAt:string;}
// Separate parser: existing verification messages never enter the support engine.
export function parseSupportMessages(payload:unknown,expectedInstance:string):SupportMessage[]{
 const root=object(payload);if(!root||root.instance!==expectedInstance||typeof root.event!=='string'||root.event.toLowerCase().replaceAll('_','.')!=='messages.upsert')return [];
 const data=Array.isArray(root.data)?root.data:[root.data];if(data.length>100)throw new Error('Too many messages');
 const result:SupportMessage[]=[];
 for(const entry of data){
  const item=object(entry),key=object(item?.key);if(!item||!key||key.fromMe!==false||typeof key.id!=='string'||key.id.length<1||key.id.length>200)continue;
  if(typeof key.remoteJid!=='string'||!/@(s\.whatsapp\.net|c\.us|lid)$/.test(key.remoteJid))continue;
  const phones=[...new Set([key.remoteJid,key.remoteJidAlt,key.senderPn,item.senderPn].map(phoneFromJid).filter((value):value is string=>!!value))];if(phones.length!==1)continue;
  const text=messageText(item.message)?.trim();if(!text||text.length>1500||/^VERIFY_/i.test(text)||/^\d{4,8}$/.test(text)||/(otp|passcode|verification code)[^0-9]{0,20}\d{4,8}|password\s*[:=]/i.test(text))continue;
  const stamp=Number(item.messageTimestamp);if(!Number.isFinite(stamp)||stamp*1000<Date.now()-900000||stamp*1000>Date.now()+300000)continue;
  result.push({phone:phones[0],messageId:key.id,text,sentAt:new Date(stamp*1000).toISOString()});
 }
 return result;
}
