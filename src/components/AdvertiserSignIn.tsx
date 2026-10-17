"use client";
import { useEffect, useState } from 'react';
import { Mail, ArrowRight, ShieldCheck, Phone } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {PhoneOtp} from './PhoneOtp';
import {WhatsAppSignIn} from './WhatsAppSignIn';
import { WhatsAppIcon,GoogleIcon } from './BrandIcons';
import { useAdvertiserSession } from './AdvertiserSession';
export function AdvertiserSignIn({ forPosting = false }: { forPosting?: boolean }) {
 const {session}=useAdvertiserSession();
 const [email,setEmail]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[google,setGoogle]=useState(false),[sent,setSent]=useState(false),[phoneLogin,setPhoneLogin]=useState(false),[whatsapp,setWhatsapp]=useState(false),[method,setMethod]=useState<'email'|'whatsapp'|'phone'|null>(null);
 useEffect(()=>{
  const controller=new AbortController();
  fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`,{headers:{apikey:process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY||''},signal:controller.signal,cache:'no-store'})
   .then(async response=>{if(!response.ok)throw Error();const body=await response.json();if(!controller.signal.aborted)setGoogle(body.external?.google===true);})
   .catch(()=>{if(!controller.signal.aborted)setGoogle(false);});
  fetch('/api/account-contact',{signal:controller.signal,cache:'no-store'}).then(response=>response.json()).then(result=>{if(!controller.signal.aborted){setWhatsapp(result.whatsapp_login===true);setPhoneLogin(result.phone_login===true);}}).catch(()=>{});
  return ()=>controller.abort();
 },[]);
 async function signIn(provider:'email'|'google') {
  if(busy)return;setBusy(true);setMessage('');
  const redirect=window.location.origin+'/dashboard'+(forPosting?'?post=1':'');
  try{
   if(forPosting) { try { sessionStorage.setItem('tolet:post-intent','1'); } catch { /* Redirect query preserves intent. */ } }
   if(provider==='google'){
    const {error}=session?.user.is_anonymous?await supabase.auth.linkIdentity({provider:'google',options:{redirectTo:redirect}}):await supabase.auth.signInWithOAuth({provider:'google',options:{redirectTo:redirect}});
    if(error)throw error;
   }else{
    const {error}=session?.user.is_anonymous?await supabase.auth.updateUser({email:email.trim()},{emailRedirectTo:redirect}):await supabase.auth.signInWithOtp({email:email.trim(),options:{emailRedirectTo:redirect}});
    if(error)throw error;setSent(true);setMessage('Open the sign-in link in your inbox. You can return here once you’re signed in.');
   }
  }catch(error){setMessage(error instanceof Error?error.message:'Unable to sign in. Please try again.');}finally{setBusy(false);}
 }
 return <section className="portal-panel portal-form p-6"><span className="inline-flex rounded-xl bg-sky-50 p-3 text-[#005B94]"><ShieldCheck size={24}/></span><h2 className="mt-4 text-xl font-bold">{forPosting?'Sign in to post your property':'Your Letting Management Account'}</h2><p className="mt-2 text-sm leading-6 text-slate-500">{forPosting?'One sign-in keeps your listings together, so you can manage them from any device.':'Sign in to view and manage the properties linked to your account.'}</p>
 <button type="button" disabled={!google||busy} onClick={()=>void signIn('google')} className="mt-5 flex min-h-12 w-full items-center justify-center gap-3 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"><GoogleIcon/>Continue with Google</button>
 {whatsapp?<button type="button" aria-expanded={method==='whatsapp'} onClick={()=>setMethod(value=>value==='whatsapp'?null:'whatsapp')} className="mt-3 flex min-h-12 w-full items-center justify-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800 transition-colors hover:bg-emerald-100"><WhatsAppIcon width={21} height={21}/>Continue with WhatsApp</button>:null}
 <button type="button" aria-expanded={method==='email'} onClick={()=>setMethod(value=>value==='email'?null:'email')} className="mt-3 flex min-h-12 w-full items-center justify-center gap-3 rounded-xl bg-[#005B94] px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-[#004775]"><Mail size={21}/>Continue with email</button>
 {phoneLogin?<button type="button" aria-expanded={method==='phone'} onClick={()=>setMethod(value=>value==='phone'?null:'phone')} className="mt-3 flex min-h-12 w-full items-center justify-center gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-bold text-[#005B94] hover:bg-sky-100"><Phone size={21}/>Continue with phone</button>:null}
 {method==='phone'&&phoneLogin?<PhoneOtp forPosting={forPosting}/>:null}
 {method==='whatsapp' &&whatsapp?<WhatsAppSignIn forPosting={forPosting}/>:null}

 {method==='email'?<form onSubmit={e=>{e.preventDefault();void signIn('email');}} className="mt-5 space-y-3 rounded-xl bg-slate-50 p-4"><label htmlFor="advertiser-email" className="block text-sm font-semibold">Email address</label><div className="relative"><Mail className="absolute left-3 top-3.5 text-slate-400" size={18}/><input id="advertiser-email" type="email" required autoComplete="email" placeholder="you@example.com" value={email} onChange={e=>setEmail(e.target.value)} className="w-full rounded-xl border border-slate-200 py-3 pl-10 pr-3 text-sm focus:outline-[#005B94]"/></div><button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#005B94] px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{busy?'Please wait…':sent?'Send another sign-in link':'Send sign-in link'}<ArrowRight size={17}/></button></form>:null}
 {message?<p role="status" className="mt-4 rounded-xl bg-sky-50 p-3 text-sm text-[#005B94]">{message}</p>:null}<p className="mt-4 text-center text-xs text-slate-500">No password needed. Government ID is optional.</p></section>;
}
