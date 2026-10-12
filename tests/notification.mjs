import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const source = ts.transpileModule(readFileSync(new URL('../src/lib/server/lifecycle.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const updates = [];
const db = {
  rpc: async () => ({ data: [{ id: 'test-job', kind: 'report', recipient: 'test@example.com', listing_id: 'test-listing', subject: 'Test report', body: 'Test details' }], error: null }),
  from: () => ({ update: value => ({ eq: async () => { updates.push(value); return { error: null }; } }) }),
};
let fail = false;
const sandbox = { exports: {}, Buffer, URL, AbortSignal, Date, console, process: { env: { NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'test-key', RENEWAL_SIGNING_SECRET: 'x'.repeat(40), APP_URL: 'https://example.com', RESEND_API_KEY: 'test-email-key', EMAIL_FROM: 'test@example.com' } }, require: name => name === 'server-only' ? {} : name === '@supabase/supabase-js' ? { createClient: () => db } : require(name), fetch: async (_url, input) => {
  assert.equal(input.headers['Idempotency-Key'], 'tolet-test-job');
  assert.equal(JSON.parse(input.body).to[0], 'test@example.com');
  assert.equal(JSON.parse(input.body).cc[0], 'support@toletodisha.in');
  return { ok: !fail, status: fail ? 500 : 200 };
} };
vm.runInNewContext(source, sandbox);
const api = sandbox.exports;
const cycle = new Date(Date.now() + 86400000).toISOString();
const token = api.renewalToken('test-listing', cycle);
assert.equal(api.verifyRenewalToken(token).id, 'test-listing');
assert.throws(() => api.verifyRenewalToken(token.replace('test', 'fake') + 'x'));
assert.throws(() => api.verifyRenewalToken(api.renewalToken('test-listing', new Date(Date.now() - 8 * 86400000).toISOString())));
let result = await api.dispatchEmails(1);
assert.equal(result.sent, 1);
assert.ok(updates[0].sent_at);
updates.length = 0; fail = true;
result = await api.dispatchEmails(1);
assert.equal(result.failed, 1);
assert.ok(updates[0].available_at);
assert.equal(updates[0].sent_at, undefined);
console.log('PASS: signed links reject tampering/expiry, delivery uses idempotency keys, failures remain retryable. No real emails sent.');
