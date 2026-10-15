import 'server-only';
import {serverDb} from './lifecycle';
import {sendWhatsApp,whatsappDeliveryReady} from './whatsapp-delivery';
type Reply={id:string;phone:string;body:string;lease:string};
export async function dispatchSupportReplies(limit=5){
 if(!whatsappDeliveryReady())return {sent:0,failed:0};
 const db=serverDb();const {data,error}=await db.rpc('support_claim_replies',{p_limit:limit});if(error)throw error;
 let sent=0,failed=0;
 for(const reply of (data||[]) as Reply[]){
  try{
   await sendWhatsApp(reply.phone,reply.body);
   const result=await db.from('support_replies').update({sent_at:new Date().toISOString(),last_error:null}).eq('id',reply.id).eq('lease',reply.lease);if(result.error)throw result.error;sent++;
  }catch{
   failed++;const result=await db.from('support_replies').update({available_at:new Date(Date.now()+300000).toISOString(),last_error:'Delivery failed; retry pending'}).eq('id',reply.id).eq('lease',reply.lease);if(result.error)throw result.error;
  }
 }
 return {sent,failed};
}
