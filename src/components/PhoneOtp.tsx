"use client";
import {useEffect,useId,useState} from 'react';
import {useRouter} from 'next/navigation';
import {Phone,ShieldCheck} from 'lucide-react';
import {supabase} from '@/lib/supabase';
import {loadPhoneWidget,widgetAction} from '@/lib/client/msg91-widget';
export function PhoneOtp({linkAccount=false,forPosting=false,preview=false,onVerified}:{linkAccount?:boolean;forPosting?:boolean;preview?:boolean;onVerified?:(phone:string)=>void}){
 const router=useRouter(),id='phone-captcha-'+useId().replace(/[^a-zA-Z0-9]/g,'');
 const [phone,setPhone]=useState(''),[code,setCode]=useState(''),[challenge,setChallenge]=useState(''),[requestId,setRequestId]=useState(''),[sentTo,setSentTo]=useState('');
 const [busy,setBusy]=useState(false),[ready,setReady]=useState(preview),[message,setMessage]=useState(''),[done,setDone]=useState(false),[resendAt,setResendAt]=useState(0),[remaining,setRemaining]=useState(0);
 useEffect(()=>{if(preview)return;let active=true;loadPhoneWidget(id).then(()=>{if(active)setReady(true);}).catch(error=>{if(active)setMessage(error.message);});return()=>{active=false;};},[id,preview]);
 useEffect(()=>{if(!resendAt)return;const tick=()=>setRemaining(Math.max(0,Math.ceil((resendAt-Date.now())/1000)));tick();const timer=setInterval(tick,1000);return()=>clearInterval(timer);},[resendAt]);
 async function api(body:Record<string,unknown>){
  const headers:Record<string,string>={'Content-Type':'application/json'};
  if(linkAccount){const {data}=await supabase.auth.getSession();if(!data.session)throw new Error('Please sign in again.');headers.Authorization=`Bearer ${data.session.access_token}`;}
  const response=await fetch('/api/auth/phone',{method:'POST',headers,body:JSON.stringify(body)});const result=await response.json();if(!response.ok)throw new Error(result.error||'Please retry.');return result;
 }
 async function send(){
  if(busy||Date.now()<resendAt)return;setBusy(true);setMessage('');
  try{
   const digits=phone.replace(/[\s()+-]/g,''),number=digits.length===10?'+91'+digits:'+'+digits;
   if(!/^\+91[6-9][0-9]{9}$/.test(number))throw new Error('Enter one valid 10-digit Indian mobile number.');
   if(preview){setChallenge('preview');setSentTo(number);setResendAt(Date.now()+60000);setMessage('Preview only: no SMS was sent. Enter any six digits to preview success.');return;}
   const next=await api({action:'start',phone:number,purpose:linkAccount?'link':'login'});
   setResendAt(Date.now()+60000);
   const result=await widgetAction(sentTo===number&&requestId?'retry':'send',number.slice(1),requestId||undefined);
   const providerId=typeof result.message==='string'?result.message:typeof result.reqId==='string'?result.reqId:'';
   if(providerId)setRequestId(providerId);
   setChallenge(next.challenge_id);setSentTo(number);setMessage('Enter the six-digit code sent by SMS.');
  }catch(error){setMessage(error instanceof Error?error.message:'Unable to send the code.');}finally{setBusy(false);}
 }
 async function verify(event:React.FormEvent){
  event.preventDefault();if(busy)return;setBusy(true);setMessage('');
  try{
   if(!/^\d{6}$/.test(code))throw new Error('Enter the six-digit SMS code.');
   if(preview){setDone(true);setMessage(linkAccount?'Preview: phone verified.':'Preview: signed in with your phone.');onVerified?.(sentTo);return;}
   const proof=await widgetAction('verify',code,requestId||undefined);
   const token=typeof proof['access-token']==='string'?proof['access-token']:proof.message;
   if(typeof token!=='string')throw new Error('Unable to confirm the code. Request a new one.');
   const result=await api({action:'verify',challenge_id:challenge,access_token:token});
   if(!linkAccount){if(!result.session?.access_token||!result.session?.refresh_token)throw new Error('Unable to sign in. Please retry.');const {error}=await supabase.auth.setSession(result.session);if(error)throw error;}
   window.dispatchEvent(new Event('tolet:contacts-updated'));setDone(true);setCode('');setMessage(linkAccount?'Call number verified. WhatsApp verification is unchanged.':'Signed in successfully.');onVerified?.(result.phone_number);
   if(!linkAccount)router.push('/dashboard'+(forPosting?'?post=1':''));else router.refresh();
  }catch(error){setMessage(error instanceof Error?error.message:'Unable to verify the code.');}finally{setBusy(false);}
 }
 return <section aria-label="SMS phone verification" className="mt-4 space-y-3 rounded-xl border border-sky-100 bg-sky-50/60 p-4"><h3 className="flex items-center gap-2 text-sm font-bold text-[#005B94]"><Phone size={17}/>{linkAccount?'Verify your call number':'Continue with phone'}</h3><p className="text-xs leading-5 text-slate-600">{linkAccount?'Receive an SMS code on the number renters should call.':'We’ll send an SMS code. No password needed.'}</p>{!done?<><label className="block text-sm font-medium">Mobile number<input type="tel" autoComplete="tel-national" inputMode="tel" placeholder="10-digit Indian number" value={phone} disabled={busy||!!challenge} onChange={event=>setPhone(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-300 bg-white p-3"/></label><div id={id} className="max-w-full overflow-hidden"/>{challenge?<form onSubmit={verify} className="space-y-3"><p className="text-xs text-slate-500">Code sent to {sentTo}</p><label className="block text-sm font-medium">SMS code<input required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={event=>setCode(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-300 bg-white p-3"/></label><button disabled={busy} className="w-full rounded-lg bg-[#005B94] p-3 text-sm font-bold text-white disabled:opacity-50">{busy?'Confirming…':linkAccount?'Verify phone':'Verify & sign in'}</button></form>:null}<button type="button" disabled={busy||!ready||remaining>0} onClick={()=>void send()} className="w-full rounded-lg border border-[#005B94] p-3 text-sm font-bold text-[#005B94] disabled:opacity-50">{busy?'Please wait…':!ready?'Loading secure verification…':remaining>0?challenge?`Resend available in ${remaining}s`:`Try again in ${remaining}s`:challenge?'Resend SMS code':'Send SMS code'}</button>{challenge?<button type="button" disabled={busy} onClick={()=>{setChallenge('');setSentTo('');setRequestId('');setCode('');}} className="text-xs font-semibold text-[#005B94] underline">Use another number</button>:null}</>:<p className="flex items-center gap-2 text-sm font-bold text-emerald-700"><ShieldCheck size={18}/>Phone verified · {sentTo}</p>}{!ready&&message?<button type="button" onClick={()=>void loadPhoneWidget(id).then(()=>{setReady(true);setMessage('');}).catch(error=>setMessage(error.message))} className="text-xs font-semibold text-[#005B94] underline">Reload verification</button>:null}{message?<p role="status" className="text-xs leading-5 text-slate-600">{message}</p>:null}</section>;
}
