'use client';
import {useEffect,useRef,useState} from 'react';
import {useRouter} from 'next/navigation';
import {supabase} from '@/lib/supabase';
import {WhatsAppIcon} from './BrandIcons';
export function WhatsAppSignIn({forPosting=false,linkAccount=false,changeNumber=false}:{forPosting?:boolean;linkAccount?:boolean;changeNumber?:boolean}){
 const router=useRouter();
 const actor=useRef<string|null>(null),sameNumber=useRef(false);
 const [phone,setPhone]=useState(''),[otp,setOtp]=useState(''),[sentTo,setSentTo]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[resendAt,setResendAt]=useState(0),[remaining,setRemaining]=useState(0),[updateListings,setUpdateListings]=useState(false),[verified,setVerified]=useState(false),[applyPending,setApplyPending]=useState(false);
 useEffect(()=>{if(!resendAt)return;const tick=()=>setRemaining(Math.max(0,Math.ceil((resendAt-Date.now())/1000)));tick();const timer=setInterval(tick,1000);return()=>clearInterval(timer);},[resendAt]);
 async function accountAction(action:string,number?:string){
  const {data}=await supabase.auth.getSession();if(!data.session)throw new Error('Please sign in again.');
  const response=await fetch('/api/account-contact',{method:'POST',headers:{Authorization:`Bearer ${data.session.access_token}`,'Content-Type':'application/json'},body:JSON.stringify({action,phone:number,code:number})});
  const result=await response.json();if(!response.ok)throw new Error(result.error||'Please retry.');return result;
 }
 async function applyNumber(){setBusy(true);try{const result=await accountAction('apply_verified_phone');setApplyPending(false);setMessage(`Verified number saved. Updated ${result.updated} listings.`);}catch(error){setMessage(error instanceof Error?error.message:'Unable to update listings.');}finally{setBusy(false);}}
 async function submit(event:React.FormEvent){
  event.preventDefault();if(busy)return;setBusy(true);setMessage('');
  try{
   if(sentTo){
    if(!/^\d{6,10}$/.test(otp))throw new Error('Enter the code from WhatsApp.');
    const {error}=await supabase.auth.verifyOtp({phone:sentTo,token:otp,type:linkAccount&&!sameNumber.current?'phone_change':'sms'});if(error)throw error;
    if(linkAccount){const current=await supabase.auth.getUser();if(current.error||current.data.user.id!==actor.current){await supabase.auth.signOut();throw new Error('Unable to link this number to your original account.');}}
    await accountAction('confirm_whatsapp',otp);
    window.dispatchEvent(new Event('tolet:contacts-updated'));
    if(linkAccount){
     const result=await supabase.auth.getUser();if(result.error)throw result.error;
     if(result.data.user.id!==actor.current){await supabase.auth.signOut();throw new Error('This number could not be linked safely. Sign in to your original account and contact support.');}
     if(!result.data.user.phone_confirmed_at||result.data.user.phone?.replace(/^\+/,'')!==sentTo.replace(/^\+/,''))throw new Error('Your number has not changed yet. Complete any remaining verification code, or contact support.');
     setVerified(true);setSentTo('');setOtp('');
     if(updateListings){setApplyPending(true);try{const result=await accountAction('apply_verified_phone');setApplyPending(false);setMessage(`Number verified. Updated ${result.updated} listings.`);}catch{setMessage('Number verified. Your existing listings have not changed. Use the button below to retry updating them.');}}
     else setMessage('Number verified. Your account and listings are preserved. Existing listing numbers stay unchanged until you edit them.');
     router.refresh();
    }else if(forPosting){try{sessionStorage.setItem('tolet:post-intent','1');}catch{/* Query preserves posting intent. */}router.push('/dashboard?post=1');}
   }else{
    const digits=phone.replace(/[\s()+-]/g,'');const normalized=digits.length===10?'+91'+digits:'+'+digits;
    if(!/^\+91[6-9][0-9]{9}$/.test(normalized))throw new Error('Enter one valid Indian WhatsApp number.');
    if(Date.now()<resendAt)throw new Error('Please wait before requesting another code.');
    if(linkAccount){const result=await supabase.auth.getUser();if(result.error)throw result.error;actor.current=result.data.user.id;sameNumber.current=!!result.data.user.phone_confirmed_at&&result.data.user.phone?.replace(/^\+/,'')===normalized.slice(1);await accountAction('check_phone',normalized);}
    const {error}=linkAccount&&!sameNumber.current?await supabase.auth.updateUser({phone:normalized}):await supabase.auth.signInWithOtp({phone:normalized,options:{channel:'sms',shouldCreateUser:true}});
    if(error)throw error;setSentTo(normalized);setResendAt(Date.now()+60000);setMessage('We sent a verification code to your WhatsApp.');
   }
  }catch(error){setMessage(error instanceof Error?error.message:'Unable to continue. Please retry.');}finally{setBusy(false);}
 }
 return <form onSubmit={submit} className="mt-5 space-y-3 rounded-xl border border-emerald-100 bg-emerald-50/50 p-4"><h3 className="flex items-center gap-2 text-sm font-bold text-emerald-800"><WhatsAppIcon width={19} height={19}/>{changeNumber?'Verify your new number':linkAccount?'Enable WhatsApp sign-in':'Continue with WhatsApp'}</h3>{changeNumber&&!verified?<p className="text-xs leading-5 text-slate-600">Your current number stays in place until the new number is verified. Your listings and paid plan stay with this account.</p>:null}{!verified?(<>{sentTo?<><p className="text-xs text-slate-600">Code sent to {sentTo}</p><label className="block text-sm font-medium">Verification code<input required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6,10}" value={otp} onChange={event=>setOtp(event.target.value)} className="mt-2 w-full rounded-lg border bg-white p-3"/></label></>:<label className="block text-sm font-medium">WhatsApp number<input required type="tel" autoComplete="tel" placeholder="10-digit Indian number" value={phone} onChange={event=>setPhone(event.target.value)} className="mt-2 w-full rounded-lg border bg-white p-3"/></label>}{linkAccount?<label className="flex items-start gap-2 text-xs leading-5 text-slate-600"><input type="checkbox" checked={updateListings} onChange={e=>setUpdateListings(e.target.checked)} className="mt-1"/>Use this WhatsApp number on all my existing listings after verification</label>:null}<button disabled={busy||(!sentTo&&remaining>0)} className="w-full rounded-lg bg-emerald-700 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{busy?'Please wait…':sentTo?'Verify and continue':remaining>0?`Request another code in ${remaining}s`:'Send code on WhatsApp'}</button>{sentTo&&<button type="button" disabled={busy} onClick={()=>{setSentTo('');setOtp('');setMessage('');}} className="text-xs font-semibold text-emerald-800 underline">Change number or request another code{remaining>0?` (${remaining}s)`:''}</button>}</>):null}{applyPending?<button type="button" disabled={busy} onClick={()=>void applyNumber()} className="rounded-lg bg-emerald-700 px-4 py-3 text-xs font-bold text-white disabled:opacity-50">Update my listings to my verified number</button>:null}{message&&<p role="status" className="text-sm text-slate-600">{message}</p>}</form>;
}
