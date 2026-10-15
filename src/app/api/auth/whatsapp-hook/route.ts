import {validAuthHook} from '@/lib/server/auth-hook-signature';
import {sendWhatsApp,whatsappLoginReady} from '@/lib/server/whatsapp-delivery';
import {serverDb} from '@/lib/server/lifecycle';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export async function POST(request:Request){
 if(!whatsappLoginReady())return reply({error:{message:'WhatsApp login is not configured.'}},503);
 try{
  if(!request.body||Number(request.headers.get('content-length')||0)>20000)return reply({error:{message:'Invalid payload.'}},400);
  const reader=request.body.getReader();const parts:Uint8Array[]=[];let size=0;
  try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>20000){await reader.cancel();return reply({error:{message:'Invalid payload.'}},400);}parts.push(value);}}finally{reader.releaseLock();}
  const body=Buffer.concat(parts).toString('utf8');
  if(!validAuthHook(body,request.headers,process.env.SUPABASE_SMS_HOOK_SECRET||''))return reply({error:{message:'Invalid signature.'}},401);
  const payload=JSON.parse(body),user=payload.user,otp=payload.sms?.otp;
  // Auth supplies the destination phone for both sign-up and phone changes.
  const raw=String(payload.sms?.phone||user?.phone||'').replace(/^\+/,'');const phone='+'+raw;
  if(!/^91[6-9][0-9]{9}$/.test(raw)||typeof otp!=='string'||!/^\d{6,10}$/.test(otp)||typeof user?.id!=='string')return reply({error:{message:'Invalid authentication message.'}},400);
  const db=serverDb();
  const allowed=await db.rpc('account_allow_otp_delivery',{p_actor:user.id,p_phone:phone});
  if(allowed.error)throw new Error('Delivery check failed');
  if(allowed.data==='limited')return reply({error:{message:'Too many requests. Try again later.'}},429);
  if(allowed.data!=='allowed')return reply({error:{message:'Use your existing sign-in method and link this number from your account settings.'}},409);
  await sendWhatsApp(phone,`Your ToLet Odisha sign-in code is ${otp}. Enter it only on www.toletodisha.in. Do not share this code.\n\nManage your listings: https://www.toletodisha.in/dashboard`);
  return reply({});
 }catch{return reply({error:{message:'WhatsApp delivery is temporarily unavailable. Please retry.'}},503);}
}
