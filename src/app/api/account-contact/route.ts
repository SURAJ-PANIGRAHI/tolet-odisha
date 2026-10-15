import {portalUser} from '@/lib/server/portal-auth';
import {consumeQuota,readInput} from '@/lib/server/lifecycle';
import {sendWhatsApp,whatsappDeliveryReady,whatsappLoginReady} from '@/lib/server/whatsapp-delivery';
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(){return reply({whatsapp_login:whatsappLoginReady(),whatsapp_messaging:whatsappDeliveryReady()});}
export async function POST(request:Request){
 try{
  const auth=await portalUser(request);if(!auth)return reply({error:'Please sign in.'},401);
  const input=await readInput(request);if(input.action!=='send_dashboard')return reply({error:'Invalid action.'},400);
  if(!whatsappDeliveryReady())return reply({error:'WhatsApp messaging is not available yet.'},503);
  const status=await auth.db.rpc('account_phone_verification_status',{p_actor:auth.user.id,p_challenge:null});
  const phone=status.data?.[0]?.phone_number;
  if(status.error||!status.data?.[0]?.verified||!phone)return reply({error:'Verify your WhatsApp number first.'},409);
  if(!await consumeQuota('dashboard-whatsapp:'+auth.user.id,3))return reply({error:'Please wait before sending another link.'},429);
  await sendWhatsApp(phone,'Your ToLet Odisha dashboard:\nhttps://www.toletodisha.in/dashboard\n\nSign in to manage your listings. This link does not grant anyone access to your account.');
  return reply({sent:true});
 }catch{return reply({error:'Unable to send the dashboard link. Please try again.'},503);}
}
