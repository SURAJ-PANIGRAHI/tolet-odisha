import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const source = ts.transpileModule(readFileSync(new URL('../src/app/api/listings/route.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
let user = null, authError = null, calls = [];
const db = { rpc: async (name, params) => { calls.push({ name, params }); return { data:'11111111-1111-4111-8111-111111111111', error:null }; } };
const normalize = value => typeof value === 'string' ? '+91' + value.replace(/\D/g,'').replace(/^91(?=\d{10}$)/,'') : null;
const env = { NEXT_PUBLIC_PHONE_OTP_ENABLED:'true', NEXT_PUBLIC_SUPABASE_URL:'https://test.supabase.co' };
const sandbox = { exports:{}, Request, Response, process:{ env }, require:name => {
 if(name === '@/lib/server/lifecycle') return { readInput:r => r.json(), consumeQuota:async()=>true, dispatchEmails:async()=>{}, serverDb:()=>db };
 if(name === '@/lib/server/phone') return { indianPhone:normalize, phoneAuth:()=>({ auth:{ getUser:async()=>({data:{user},error:authError}) } }) };
 if(name === '@/data/odisha') return { CATEGORIES:[{id:'Boys Mess'}],ODISHA_DISTRICTS:['Balasore (test)'],POPULAR_AMENITIES:[] };
 return require(name);
} };
vm.runInNewContext(source,sandbox);
const listing = { title:'Test',district:'Balasore',locality:'Test',contact_name:'Test',contact_phone:'9876543210',category:'Boys Mess',rent_monthly:1000,deposit:0,images:[],amenities:[] };
async function submit(token, email) { calls=[]; return sandbox.exports.POST(new Request('https://test.invalid/api/listings',{method:'POST',headers:token?{Authorization:'Bearer '+token}:{},body:JSON.stringify({ listing, ...(email === undefined ? {} : {email}) })})); }
assert.equal((await submit()).status,401); assert.equal(calls.length,0);
authError={message:'invalid token'}; assert.equal((await submit('forged')).status,401); assert.equal(calls.length,0); authError=null;
user={id:'test-user',phone:'919876543210',phone_confirmed_at:null}; assert.equal((await submit('unverified')).status,401);
user.phone_confirmed_at=new Date().toISOString();user.phone='919876543211';assert.equal((await submit('other-number')).status,401);
user.phone='919876543210';let response=await submit('valid');assert.equal(response.status,200);assert.equal(calls[0].name,'submit_phone_verified_listing');assert.equal(calls[0].params.p_email,null);assert.equal(calls[0].params.p_verified_phone,'+919876543210');assert.equal(calls[0].params.p_user,'test-user');assert.match(calls[0].params.p_management_hash,/^[a-f0-9]{64}$/);assert.equal(response.headers.get('cache-control'),'no-store');
assert.equal((await submit('valid','invalid')).status,400);assert.equal(calls.length,0);
env.NEXT_PUBLIC_PHONE_OTP_ENABLED='false';assert.equal((await submit()).status,200);assert.equal(calls[0].name,'submit_managed_listing');
console.log('PASS: OTP gate rejects missing/forged/unverified/mismatched identities; verified matching phone publishes without email; disabled rollout preserves current posting.');
