import {proofHash,msg91Ready} from '@/lib/server/msg91';
import {indianPhone} from '@/lib/server/evolution';
import {portalUser} from '@/lib/server/portal-auth';
import {consumeQuota,readInput} from '@/lib/server/lifecycle';
import {sendWhatsApp,whatsappDeliveryReady,whatsappLoginReady} from '@/lib/server/whatsapp-delivery';
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(){return reply({phone_login:msg91Ready()&&!!process.env.SUPABASE_SERVICE_ROLE_KEY,whatsapp_login:whatsappLoginReady(),whatsapp_messaging:whatsappDeliveryReady()});}
export async function POST(request:Request){
 if(request.headers.get("origin")!==new URL(request.url).origin)return reply({error:"Invalid origin."},403);
 try{
  const auth=await portalUser(request);if(!auth)return reply({error:'Please sign in.'},401);
  const input=await readInput(request);
  if(input.action==='confirm_whatsapp'){
   const phone=auth.user.phone_confirmed_at&&auth.user.phone?indianPhone(auth.user.phone):null;
   if(!phone||typeof input.code!=='string'||!/^\d{6,10}$/.test(input.code))return reply({error:'Complete WhatsApp verification first.'},400);
   if(!await consumeQuota('confirm-wa:'+auth.user.id,5))return reply({error:'Please try again later.'},429);
   const result=await auth.db.rpc('account_confirm_whatsapp_otp',{p_actor:auth.user.id,p_phone:phone,p_hash:proofHash(phone+':'+input.code)});
   if(result.error||result.data!==true)return reply({error:'WhatsApp confirmation could not be recorded. Request a new WhatsApp code.'},409);
   return reply({verified:true});
  }
  if(input.action==='check_phone'){
   const phone=typeof input.phone==='string'?indianPhone(input.phone):null;if(!phone)return reply({error:'Enter one valid Indian number.'},400);
   if(!await consumeQuota('check-account-phone:'+auth.user.id,10))return reply({error:'Please try again later.'},429);
   const allowed=await auth.db.rpc('account_phone_login_allowed',{p_actor:auth.user.id,p_phone:phone});
   if(allowed.error)throw allowed.error;if(!allowed.data)return reply({error:'This number is already linked to another account or verification request. Sign in to that account or contact support.'},409);
   return reply({available:true});
  }
  if(input.action==='apply_verified_phone'){
   if(!auth.user.phone_confirmed_at||!auth.user.phone)return reply({error:'Verify your new number first.'},409);
   if(!await consumeQuota('apply-account-phone:'+auth.user.id,5))return reply({error:'Please try again later.'},429);
   const result=await auth.db.rpc('account_apply_verified_phone',{p_actor:auth.user.id});if(result.error)throw result.error;return reply({updated:result.data});
  }
  if(input.action!=='send_dashboard')return reply({error:'Invalid action.'},400);
  if(!whatsappDeliveryReady())return reply({error:'WhatsApp messaging is not available yet.'},503);
  const status=await auth.db.rpc('account_phone_verification_status',{p_actor:auth.user.id,p_challenge:null});
  const phone=status.data?.[0]?.phone_number;
  if(status.error||!status.data?.[0]?.verified||!phone)return reply({error:'Verify your WhatsApp number first.'},409);
  if(!await consumeQuota('dashboard-whatsapp:'+auth.user.id,3))return reply({error:'Please wait before sending another link.'},429);
  await sendWhatsApp(phone,'Your ToLet Odisha dashboard:\nhttps://www.toletodisha.in/dashboard\n\nSign in to manage your listings. This link does not grant anyone access to your account.');
  return reply({sent:true});
 }catch{return reply({error:'Unable to send the dashboard link. Please try again.'},503);}
}
