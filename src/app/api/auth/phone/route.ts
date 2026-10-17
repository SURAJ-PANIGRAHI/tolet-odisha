import {randomBytes} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {serverDb,consumeQuota} from '@/lib/server/lifecycle';
import {portalUser} from '@/lib/server/portal-auth';
import {indianPhone,isUuid,readJsonLimited} from '@/lib/server/evolution';
import {msg91Ready,verifyMsg91Proof,proofHash,openAuthOtp,PhoneAuthError} from '@/lib/server/msg91';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const reply=(data:unknown,status=200,cookie?:string)=>Response.json(data,{status,headers:{'Cache-Control':'no-store',...(cookie?{'Set-Cookie':cookie}:{})}});
const cookieName='tolet-sms-challenge';
function challengeCookie(request:Request,value:string,maxAge=900){return `${cookieName}=${value}; Path=/api/auth/phone; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${new URL(request.url).protocol==='https:'?'; Secure':''}`;}
export async function GET(request:Request){
 try{const auth=await portalUser(request);if(!auth)return reply({error:'Please sign in.'},401);const {data,error}=await auth.db.rpc('sms_auth_status',{p_actor:auth.user.id});if(error)throw error;return reply({available:msg91Ready(),verified:!!data?.[0],phone_number:data?.[0]?.phone_e164||null});}
 catch{return reply({error:'Unable to load phone verification.'},503);}
}
export async function POST(request:Request){
 if(request.headers.get('origin')!==new URL(request.url).origin)return reply({error:'Invalid origin.'},403);
 if(!msg91Ready()||!process.env.SUPABASE_SERVICE_ROLE_KEY)return reply({error:'Phone verification is not configured.'},503);
 try{
  const input=await readJsonLimited(request,12000) as Record<string,unknown>;
  const auth=request.headers.has('authorization')?await portalUser(request):null;
  if(request.headers.has('authorization')&&!auth)return reply({error:'Please sign in again.'},401);
  const db=auth?.db||serverDb();
  if(input.action==='start'){
   const phone=typeof input.phone==='string'?indianPhone(input.phone):null;if(!phone)throw new PhoneAuthError('Enter one valid 10-digit Indian mobile number.');
   if(input.purpose==='link'&&!auth)throw new PhoneAuthError('Please sign in first.',401);
   const purpose=auth?'link':'login';
   const nonce=randomBytes(32).toString('hex');
   const {data,error}=await db.rpc('sms_auth_begin',{p_nonce:proofHash(nonce),p_phone:phone,p_actor:auth?.user.id||null,p_purpose:purpose});
   if(error){if(/60 seconds|Too many requests/.test(error.message))throw new PhoneAuthError(error.message,429);throw error;}
   return reply({challenge_id:data,phone_number:phone,resend_after:60},200,challengeCookie(request,nonce));
  }
  if(input.action!=='verify'||typeof input.challenge_id!=='string'||!isUuid(input.challenge_id))throw new PhoneAuthError('Invalid request.');
  const nonce=request.headers.get('cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith(cookieName+'='))?.slice(cookieName.length+1);
  if(!nonce||!/^[0-9a-f]{64}$/.test(nonce))throw new PhoneAuthError('Your verification request expired. Request a new code.',401);
  if(!await consumeQuota('sms-proof:'+proofHash(nonce),5))throw new PhoneAuthError('Too many attempts. Request a new code.',429);
  const challenge=await db.rpc('sms_auth_challenge',{p_id:input.challenge_id,p_nonce:proofHash(nonce),p_actor:auth?.user.id||null});
  if(challenge.error||!challenge.data?.[0])throw new PhoneAuthError('Your verification request expired. Request a new code.',401);
  const phone=await verifyMsg91Proof(input.access_token,challenge.data[0].phone_e164);
  const consumed=await db.rpc('sms_auth_consume',{p_id:input.challenge_id,p_nonce:proofHash(nonce),p_actor:auth?.user.id||null,p_phone:phone,p_proof:proofHash(String(input.access_token))});
  if(consumed.error||consumed.data!==true)throw new PhoneAuthError('This verification has already been used. Request a new code.',409);
  const resolved=await db.rpc('sms_auth_resolve',{p_phone:phone,p_actor:auth?.user.id||null});
  if(resolved.error)throw new PhoneAuthError('This number is linked to another account. Sign in to that account or contact support.',409);
  let owner=resolved.data?.[0] as {user_id:string;auth_phone:string|null;whatsapp_phone:string|null;sms_phone:string|null}|undefined;
  if(!owner){
   if(auth)throw new PhoneAuthError('Unable to link this account.',409);
   const created=await db.auth.admin.createUser({phone:phone.slice(1),phone_confirm:true});
   if(created.error||!created.data.user)throw new PhoneAuthError('Unable to create the account. Try signing in with your existing method.',409);
   owner={user_id:created.data.user.id,auth_phone:phone,whatsapp_phone:null,sms_phone:null};
  }
  const recorded=await db.rpc('sms_auth_record',{p_actor:owner.user_id,p_phone:phone});if(recorded.error)throw recorded.error;
  // Preserve a different WhatsApp login number. Change Auth's phone only when it was the SMS identity, or absent.
  let sessionPhone=owner.auth_phone;
  if(!sessionPhone||(sessionPhone!==phone&&sessionPhone===owner.sms_phone&&sessionPhone!==owner.whatsapp_phone)){
   const changed=await db.auth.admin.updateUserById(owner.user_id,{phone:phone.slice(1),phone_confirm:true});if(changed.error)throw changed.error;sessionPhone=phone;
  }
  if(auth)return reply({verified:true,phone_number:phone},200,challengeCookie(request,'',0));
  if(!sessionPhone)throw new Error('Missing sign-in phone');
  const exchangeNonce=randomBytes(32).toString('hex'),exchangeHash=proofHash(exchangeNonce);
  const started=await db.rpc('sms_auth_exchange_begin',{p_actor:owner.user_id,p_phone:sessionPhone,p_nonce:exchangeHash});if(started.error)throw started.error;
  try{
   const native=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
   const sent=await native.auth.signInWithOtp({phone:sessionPhone,options:{channel:'sms',shouldCreateUser:false}});if(sent.error)throw sent.error;
   const handoff=await db.rpc('sms_auth_exchange_take',{p_actor:owner.user_id,p_nonce:exchangeHash});if(handoff.error||typeof handoff.data!=='string')throw new Error('Exchange unavailable');
   const verified=await native.auth.verifyOtp({phone:sessionPhone,token:openAuthOtp(handoff.data),type:'sms'});
   if(verified.error||!verified.data.session||verified.data.user?.id!==owner.user_id)throw new Error('Session unavailable');
   return reply({verified:true,phone_number:phone,session:{access_token:verified.data.session.access_token,refresh_token:verified.data.session.refresh_token}},200,challengeCookie(request,'',0));
  }finally{await db.rpc('sms_auth_exchange_cancel',{p_actor:owner.user_id,p_nonce:exchangeHash});}
 }catch(error){
  if(error instanceof PhoneAuthError)return reply({error:error.message},error.status);
  return reply({error:'Unable to complete phone verification. Please wait a minute and try again.'},503);
 }
}
