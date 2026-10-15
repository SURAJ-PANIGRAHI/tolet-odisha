import 'server-only';
// Delivery is independent of Supabase Auth. Replace this adapter to move to Meta.
export function whatsappDeliveryReady(){return !!(process.env.EVOLUTION_API_URL&&process.env.EVOLUTION_API_KEY&&process.env.EVOLUTION_INSTANCE_NAME);}
export function whatsappLoginReady(){return process.env.WHATSAPP_LOGIN_ENABLED==='true'&&!!process.env.SUPABASE_SMS_HOOK_SECRET&&whatsappDeliveryReady();}
export async function sendWhatsApp(phone:string,text:string){
 if(!/^\+91[6-9][0-9]{9}$/.test(phone)||!whatsappDeliveryReady())throw new Error('WhatsApp delivery unavailable');
 const base=new URL(process.env.EVOLUTION_API_URL!);
 if(base.protocol!=='https:'||base.username||base.password||base.search||base.hash)throw new Error('Invalid delivery configuration');
 const response=await fetch(`${base.href.replace(/\/$/,'')}/message/sendText/${encodeURIComponent(process.env.EVOLUTION_INSTANCE_NAME!)}`,{method:'POST',redirect:'error',signal:AbortSignal.timeout(3500),headers:{'Content-Type':'application/json',apikey:process.env.EVOLUTION_API_KEY!},body:JSON.stringify({number:phone.slice(1),text,linkPreview:false})});
 if(!response.ok)throw new Error('WhatsApp delivery failed');
 const result=await response.json();if(!result?.key?.id)throw new Error('WhatsApp delivery not acknowledged');
}
