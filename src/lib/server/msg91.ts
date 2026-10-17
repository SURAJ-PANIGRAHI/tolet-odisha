import 'server-only';
import {createHash,createCipheriv,createDecipheriv,randomBytes} from 'node:crypto';
import {indianPhone} from './evolution';
export const proofHash=(value:string)=>createHash('sha256').update(value).digest('hex');
export function msg91Ready(){return !!(process.env.MSG91_AUTH_KEY&&process.env.NEXT_PUBLIC_MSG91_WIDGET_ID&&process.env.NEXT_PUBLIC_MSG91_WIDGET_TOKEN);}
export class PhoneAuthError extends Error {constructor(message:string,public status=400){super(message);}}
export async function verifyMsg91Proof(token:unknown,expectedPhone:string){
 if(typeof token!=='string'||token.length<40||token.length>8192)throw new PhoneAuthError('Invalid verification result. Request a new code.');
 if(!msg91Ready())throw new PhoneAuthError('Phone verification is not configured.',503);
 let response:Response;
 try{response=await fetch('https://control.msg91.com/api/v5/widget/verifyAccessToken',{method:'POST',redirect:'error',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({authkey:process.env.MSG91_AUTH_KEY,'access-token':token}),signal:AbortSignal.timeout(10000)});}catch{throw new PhoneAuthError('Phone verification is temporarily unavailable. Please retry.',503);}
 let result:unknown;try{result=await response.json();}catch{throw new PhoneAuthError('Unable to confirm the code. Please retry.',503);}
 const data=result&&typeof result==='object'?result as Record<string,unknown>:null;
 // Only the provider's server-verified identifier is authoritative. Never trust a client phone claim or a decoded JWT alone.
 const phone=typeof data?.message==='string'?indianPhone(data.message):null;
 if(!response.ok||data?.type!=='success'||!phone||phone!==expectedPhone)throw new PhoneAuthError('The code could not be confirmed for this number. Request a new code.',401);
 return phone;
}
function encryptionKey(){const key=process.env.MSG91_AUTH_KEY;if(!key)throw new Error('Phone verification unavailable');return createHash('sha256').update('tolet-sms-session-v1:'+key).digest();}
export function sealAuthOtp(code:string){const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',encryptionKey(),iv);const encrypted=Buffer.concat([cipher.update(code,'utf8'),cipher.final()]);return Buffer.concat([iv,cipher.getAuthTag(),encrypted]).toString('base64url');}
export function openAuthOtp(value:string){const raw=Buffer.from(value,'base64url');if(raw.length<29||raw.length>100)throw new Error('Invalid exchange');const decipher=createDecipheriv('aes-256-gcm',encryptionKey(),raw.subarray(0,12));decipher.setAuthTag(raw.subarray(12,28));const code=Buffer.concat([decipher.update(raw.subarray(28)),decipher.final()]).toString('utf8');if(!/^\d{6,10}$/.test(code))throw new Error('Invalid exchange');return code;}
