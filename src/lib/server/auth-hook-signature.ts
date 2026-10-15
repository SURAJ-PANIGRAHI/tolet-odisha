import 'server-only';
import {createHmac,timingSafeEqual} from 'node:crypto';
export function validAuthHook(body:string,headers:Headers,secret:string,now=Date.now()){
 const id=headers.get('webhook-id')||'',time=headers.get('webhook-timestamp')||'',signatures=headers.get('webhook-signature')||'';
 if(!id||id.length>200||!/^\d{10,13}$/.test(time)||Math.abs(now/1000-Number(time))>300||signatures.length>2000)return false;
 return secret.split('|').some(value=>{
  const raw=value.replace(/^v1,whsec_/,'').replace(/^whsec_/,'');
  if(!/^[A-Za-z0-9+/]+={0,2}$/.test(raw))return false;
  const key=Buffer.from(raw,'base64');if(key.length<32)return false;
  const expected=createHmac('sha256',key).update(`${id}.${time}.${body}`).digest();
  return signatures.split(' ').some(signature=>{if(!signature.startsWith('v1,'))return false;const actual=Buffer.from(signature.slice(3),'base64');return actual.length===expected.length&&timingSafeEqual(actual,expected);});
 });
}
