'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {supabase} from '@/lib/supabase';
import {WhatsAppIcon} from './BrandIcons';
export function WhatsAppSignIn({forPosting=false,linkAccount=false}:{forPosting?:boolean;linkAccount?:boolean}){
 const router=useRouter();
 const [phone,setPhone]=useState(''),[otp,setOtp]=useState(''),[sentTo,setSentTo]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[resendAt,setResendAt]=useState(0);
 async function submit(event:React.FormEvent){
  event.preventDefault();if(busy)return;setBusy(true);setMessage('');
  try{
   if(sentTo){
    if(!/^\d{6,10}$/.test(otp))throw new Error('Enter the code from WhatsApp.');
    const {error}=await supabase.auth.verifyOtp({phone:sentTo,token:otp,type:linkAccount?'phone_change':'sms'});if(error)throw error;
    if(linkAccount){setMessage('WhatsApp sign-in is enabled. Refresh your dashboard.');setSentTo('');setOtp('');}
    else if(forPosting){try{sessionStorage.setItem('tolet:post-intent','1');}catch{/* Query preserves posting intent. */}router.push('/dashboard?post=1');}
   }else{
    const digits=phone.replace(/\D/g,'');const normalized=digits.length===10?'+91'+digits:'+'+digits;
    if(!/^\+91[6-9][0-9]{9}$/.test(normalized))throw new Error('Enter a valid Indian WhatsApp number.');
    if(Date.now()<resendAt)throw new Error('Please wait a minute before requesting another code.');
    const {error}=linkAccount?await supabase.auth.updateUser({phone:normalized}):await supabase.auth.signInWithOtp({phone:normalized,options:{channel:'sms',shouldCreateUser:true}});
    if(error)throw error;setSentTo(normalized);setResendAt(Date.now()+60000);setMessage('We sent a sign-in code to your WhatsApp.');
   }
  }catch(error){setMessage(error instanceof Error?error.message:'Unable to sign in. Please retry.');}finally{setBusy(false);}
 }
 return <form onSubmit={submit} className="mt-5 space-y-3 rounded-xl border border-emerald-100 bg-emerald-50/50 p-4"><h3 className="flex items-center gap-2 text-sm font-bold text-emerald-800"><WhatsAppIcon width={19} height={19}/>{linkAccount?'Enable WhatsApp sign-in':'Continue with WhatsApp'}</h3>{sentTo?<><p className="text-xs text-slate-600">Code sent to {sentTo}</p><label className="block text-sm font-medium">Verification code<input required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6,10}" value={otp} onChange={event=>setOtp(event.target.value)} className="mt-2 w-full rounded-lg border bg-white p-3"/></label></>:<label className="block text-sm font-medium">WhatsApp number<input required type="tel" autoComplete="tel" placeholder="10-digit Indian number" value={phone} onChange={event=>setPhone(event.target.value)} className="mt-2 w-full rounded-lg border bg-white p-3"/></label>}<button disabled={busy} className="w-full rounded-lg bg-emerald-700 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{busy?'Please wait…':sentTo?'Verify and continue':'Send code on WhatsApp'}</button>{sentTo&&<button type="button" disabled={busy} onClick={()=>{setSentTo('');setOtp('');setMessage('');}} className="text-xs font-semibold text-emerald-800 underline">Change number or request another code</button>}{message&&<p role="status" className="text-sm text-slate-600">{message}</p>}</form>;
}
