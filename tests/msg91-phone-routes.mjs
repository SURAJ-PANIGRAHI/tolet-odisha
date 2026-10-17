import {readFileSync} from 'node:fs';import assert from 'node:assert/strict';import ts from 'typescript';import * as crypto from 'node:crypto';
function load(path,mocks){const mod={exports:{}};const code=ts.transpileModule(readFileSync(new URL('../'+path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;new Function('require','module','exports',code)(name=>{if(!(name in mocks))throw Error('Missing mock '+name);return mocks[name];},mod,mod.exports);return mod.exports;}
const evolution=load('src/lib/server/evolution.ts',{'node:crypto':crypto});
process.env.SUPABASE_SERVICE_ROLE_KEY='test-private-service-key';process.env.MSG91_AUTH_KEY='test-private-auth-key';process.env.NEXT_PUBLIC_MSG91_WIDGET_ID='test-widget';process.env.NEXT_PUBLIC_MSG91_WIDGET_TOKEN='public-widget-token';
process.env.NEXT_PUBLIC_SUPABASE_URL='https://supabase.test';process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY='public-key';
const msg91=load('src/lib/server/msg91.ts',{'server-only':{},'node:crypto':crypto,'./evolution':evolution});
const sealed=msg91.sealAuthOtp('123456');assert(!sealed.includes('123456'));assert.equal(msg91.openAuthOtp(sealed),'123456');assert.throws(()=>msg91.openAuthOtp(sealed.slice(0,-2)+'xx'));assert.throws(()=>msg91.openAuthOtp('invalid'));
const originalFetch=globalThis.fetch;let providerPhone='919876543210',providerType='success',providerStatus=200,outgoing;
globalThis.fetch=async(url,options)=>{outgoing={url,options};return Response.json({type:providerType,message:providerPhone},{status:providerStatus});};
assert.equal(await msg91.verifyMsg91Proof('t'.repeat(80),'+919876543210'),'+919876543210');assert.equal(outgoing.options.redirect,'error');assert.equal(JSON.parse(outgoing.options.body).authkey,'test-private-auth-key');
await assert.rejects(msg91.verifyMsg91Proof('t'.repeat(80),'+919876543211'));providerType='error';await assert.rejects(msg91.verifyMsg91Proof('t'.repeat(80),'+919876543210'));providerType='success';providerStatus=401;await assert.rejects(msg91.verifyMsg91Proof('t'.repeat(80),'+919876543210'));providerStatus=200;
const actor='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002',challengeId='00000000-0000-4000-8000-000000000010';
let loggedIn=false,challenge,used=false,cipher=null,exchangeNonce=null,calls=[],collision=false,wrongUser=false,waSends=0,nativeCalls=0;
const db={auth:{admin:{createUser:async()=>{throw Error('Unexpected creation');},updateUserById:async()=>{throw Error('Unexpected mutation');}}},rpc:async(name,args)=>{
 calls.push({name,args});
 switch(name){
 case 'sms_auth_begin':challenge={...args};used=false;return {data:challengeId};
 case 'sms_auth_challenge':return {data:!used&&challenge?.p_nonce===args.p_nonce&&challenge.p_actor===args.p_actor?[{phone_e164:challenge.p_phone,purpose:challenge.p_purpose}]:[]};
 case 'sms_auth_consume':if(used)return{data:false};used=true;return{data:true};
 case 'sms_auth_resolve':return collision?{error:{message:'collision'}}:{data:[{user_id:actor,auth_phone:'+919876543210',whatsapp_phone:null,sms_phone:'+919876543210'}]};
 case 'sms_auth_record':return{data:null};
 case 'sms_auth_exchange_begin':exchangeNonce=args.p_nonce;return{data:null};
 case 'sms_auth_exchange_capture':cipher=args.p_cipher;return{data:true};
 case 'sms_auth_exchange_take':return {data:args.p_nonce===exchangeNonce?cipher:null};
 case 'sms_auth_exchange_cancel':cipher=null;return{data:null};
 case 'account_allow_otp_delivery':return{data:'allowed'};
 case 'account_record_whatsapp_otp':return{data:null};
 default:throw Error('Unexpected RPC '+name);
 }
}};
const secret='v1,whsec_'+Buffer.alloc(32,7).toString('base64');process.env.SUPABASE_SMS_HOOK_SECRET=secret;
const signatures=load('src/lib/server/auth-hook-signature.ts',{'server-only':{},'node:crypto':crypto});
const hook=load('src/app/api/auth/whatsapp-hook/route.ts',{'@/lib/server/msg91':msg91,'@/lib/server/auth-hook-signature':signatures,'@/lib/server/whatsapp-delivery':{whatsappLoginReady:()=>true,sendWhatsApp:async()=>waSends++},'@/lib/server/lifecycle':{serverDb:()=>db}});
function hookRequest(valid=true){const body=JSON.stringify({user:{id:actor},sms:{phone:'919876543210',otp:'654321'}}),id='signed-event',time=Math.floor(Date.now()/1000),signature=crypto.createHmac('sha256',Buffer.alloc(32,7)).update(`${id}.${time}.${body}`).digest('base64');return new Request('https://tolet.test/api/auth/whatsapp-hook',{method:'POST',headers:{'webhook-id':id,'webhook-timestamp':String(time),'webhook-signature':'v1,'+(valid?signature:'invalid')},body});}
const native={auth:{signInWithOtp:async()=>{nativeCalls++;assert.equal((await hook.POST(hookRequest())).status,200);return{};},verifyOtp:async({token})=>{assert.equal(token,'654321');return{data:{user:{id:wrongUser?other:actor},session:{access_token:'native-access',refresh_token:'native-refresh'}}};}}};
const route=load('src/app/api/auth/phone/route.ts',{'node:crypto':crypto,'@supabase/supabase-js':{createClient:()=>native},'@/lib/server/msg91':msg91,'@/lib/server/evolution':evolution,'@/lib/server/lifecycle':{serverDb:()=>db,consumeQuota:async()=>true},'@/lib/server/portal-auth':{portalUser:async()=>loggedIn?{user:{id:actor},db}:null}});
function req(body,cookie='',origin='https://tolet.test'){return new Request('https://tolet.test/api/auth/phone',{method:'POST',headers:{origin,'Content-Type':'application/json',...(cookie?{cookie}:{}),...(loggedIn?{authorization:'Bearer existing-session'}:{})},body:JSON.stringify(body)});}
assert.equal((await route.POST(req({action:'start',phone:'9876543210'},'','https://evil.test'))).status,403);
assert.equal((await route.POST(req({action:'start',phone:'invalid'}))).status,400);
assert.equal((await hook.POST(hookRequest(false))).status,401);assert.equal(cipher,null);
let start=await route.POST(req({action:'start',phone:'9876543210'}));assert.equal(start.status,200);let cookie=start.headers.get('set-cookie');assert(cookie.includes('HttpOnly'));assert(cookie.includes('SameSite=Strict'));assert(cookie.includes('Secure'));assert(!cookie.includes(challenge.p_nonce));cookie=cookie.split(';')[0];
assert.equal((await route.POST(req({action:'verify',challenge_id:challengeId,access_token:'t'.repeat(80)}))).status,401);
const success=await route.POST(req({action:'verify',challenge_id:challengeId,access_token:'t'.repeat(80)},cookie));assert.equal(success.status,200);const result=await success.json();assert.equal(result.session.access_token,'native-access');assert.equal(nativeCalls,1);assert.equal(waSends,0,'SMS login must not send an additional WhatsApp code');assert.equal(cipher,null,'encrypted exchange removed');assert.deepEqual(Object.keys(result.session).sort(),['access_token','refresh_token']);assert.equal(result.otp,undefined);
assert.equal((await route.POST(req({action:'verify',challenge_id:challengeId,access_token:'t'.repeat(80)},cookie))).status,401,'consumed challenge');
loggedIn=true;start=await route.POST(req({action:'start',phone:'9876543210',purpose:'link'}));cookie=start.headers.get('set-cookie').split(';')[0];const linked=await route.POST(req({action:'verify',challenge_id:challengeId,access_token:'u'.repeat(80)},cookie));assert.equal(linked.status,200);assert.equal((await linked.json()).session,undefined);assert.equal(nativeCalls,1,'linking keeps existing session');
loggedIn=false;collision=true;start=await route.POST(req({action:'start',phone:'9876543210'}));cookie=start.headers.get('set-cookie').split(';')[0];assert.equal((await route.POST(req({action:'verify',challenge_id:challengeId,access_token:'v'.repeat(80)},cookie))).status,409);assert.equal(nativeCalls,1);
collision=false;wrongUser=true;start=await route.POST(req({action:'start',phone:'9876543210'}));cookie=start.headers.get('set-cookie').split(';')[0];assert.equal((await route.POST(req({action:'verify',challenge_id:challengeId,access_token:'w'.repeat(80)},cookie))).status,503);assert.equal(cipher,null);
globalThis.fetch=originalFetch;
console.log('PASS MSG91 provider + API + Auth hook: server-side proof/destination validation, errors, encryption tamper rejection, signed hook, cookie binding, native Supabase session, no extra WhatsApp delivery, replay rejection, link preservation, account collision and wrong-user rejection');
