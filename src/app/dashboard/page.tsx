"use client";
import Link from 'next/link';
import { useEffect,useState } from 'react';
import { useRouter } from 'next/navigation';
import { House,LayoutDashboard,ArrowRight,ShieldCheck,LogOut,Mail } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAdvertiserSession,isAdvertiserSession } from '@/components/AdvertiserSession';
import { AdvertiserSignIn } from '@/components/AdvertiserSignIn';
import {AccountContact} from '@/components/AccountContact';
import { AccountListings } from '@/components/AccountListings';
import { PortalAccount } from '@/components/PortalAccount';
import { IdVerification } from '@/components/IdVerification';
import { WhatsAppVerification } from '@/components/WhatsAppVerification';
import { portalEnabled } from '@/lib/client/portal';
export default function Dashboard(){
 const {session,ready}=useAdvertiserSession();
 const signedIn=isAdvertiserSession(session);
 const [message,setMessage]=useState('');
 const router=useRouter();
 useEffect(()=>{
  if(!signedIn)return;
  let pending=new URLSearchParams(window.location.search).get('post')==='1';
  try{pending=pending||sessionStorage.getItem('tolet:post-intent')==='1';sessionStorage.removeItem('tolet:post-intent');}catch{/* The redirect query still works when storage is blocked. */}
  if(pending)router.replace('/?post=1');
 },[signedIn,router]);
 async function signOut(){const {error}=await supabase.auth.signOut();if(error)setMessage('Unable to sign out. Please try again.');}
 return <main className="min-h-screen bg-slate-50 pb-16"><header className="border-b border-slate-200 bg-white px-4 py-4"><div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3"><Link href="/" className="flex items-center gap-2.5"><span className="rounded-xl bg-[#005B94] p-2.5 text-white"><House size={21}/></span><span className="text-xl font-extrabold text-slate-900">ToLet<span className="text-[#005B94]">Odisha</span><span className="block text-xs font-medium text-slate-500">Pay Zero Commission</span></span></Link><Link href="/" className="rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-bold text-[#005B94]">Browse properties</Link></div></header>
 <div className="mx-auto max-w-5xl px-4 pt-8 sm:pt-12"><section className="relative overflow-hidden rounded-3xl bg-[#005B94] p-7 text-white sm:p-9"><div className="pointer-events-none absolute -right-10 -top-16 h-64 w-64 rounded-full border-[35px] border-white/5"/><span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold"><LayoutDashboard size={15}/>FOR PROPERTY ADVERTISERS</span><h1 className="mt-4 text-3xl font-extrabold sm:text-4xl">Manage My Listings</h1><p className="mt-3 max-w-xl text-sm leading-7 text-sky-100 sm:text-base">Your properties, updates and profile — together in your account.</p></section>
 <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sky-100 bg-white px-5 py-4"><div><h2 className="text-sm font-bold text-slate-800">Looking for a place to rent?</h2><p className="mt-1 text-sm text-slate-500">Explore properties and contact advertisers directly. No sign-in needed.</p></div><Link href="/" className="inline-flex shrink-0 items-center gap-2 rounded-full bg-sky-50 px-4 py-2.5 text-sm font-bold text-[#005B94]">Browse rentals<ArrowRight size={16}/></Link></div>
 {!ready?<p role="status" className="py-8 text-slate-500">Loading your dashboard…</p>:<div className="mt-8 grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_340px]"><div className="min-w-0 space-y-8">{signedIn?<><AccountListings key={session!.user.id}/>{session!.user.phone_confirmed_at?<section className="rounded-2xl border border-emerald-100 bg-emerald-50 p-6"><h2 className="font-bold text-emerald-800">WhatsApp verified ✓</h2><p className="mt-2 text-sm text-emerald-800">{session!.user.phone} · Ready for sign-in and matching listing badges.</p></section>:<WhatsAppVerification key={'whatsapp-'+session!.user.id}/>}<IdVerification key={'id-'+session!.user.id}/>{portalEnabled?<PortalAccount key={session!.user.id}/>:null}</>:<div className="rounded-2xl border border-dashed border-sky-200 bg-white p-7"><House size={30} className="text-[#005B94]"/><h2 className="mt-4 text-xl font-bold">A home for your property listings</h2><p className="mt-3 text-sm leading-7 text-slate-500">Sign in to post a property and manage it from any device. Update details and photos, renew near expiry, or take your listing down when it’s rented.</p><p className="mt-3 text-sm font-semibold text-[#005B94]">One account. All your listings.</p></div>}
</div>
 <aside className="space-y-5">{signedIn?<section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="flex items-center gap-2 font-bold"><Mail className="text-[#005B94]" size={22}/>Your account</h2><p className="mt-3 break-all text-sm text-slate-600">{session?.user.email||('+'+(session?.user.phone||'').replace(/^\+/,''))}</p><p className="mt-3 text-sm font-semibold text-emerald-700">{session?.user.email_confirmed_at?'Email verified ✓':'Email: Not verified'}</p><button onClick={()=>void signOut()} className="mt-5 inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600"><LogOut size={16}/>Sign out</button></section>:<AdvertiserSignIn/>}{signedIn&&<AccountContact key={session!.user.id} user={session!.user}/>}
 {message?<p role="status" className="rounded-xl bg-sky-50 p-4 text-sm text-[#005B94]">{message}</p>:null}
 <div id="profile-verification" className="scroll-mt-8 rounded-2xl bg-sky-50 p-5"><h2 className="flex items-center gap-2 text-sm font-bold text-[#005B94]"><ShieldCheck size={22}/>Help renters recognise you</h2><p className="mt-3 text-sm leading-6 text-slate-600">An optional government ID review, completed manually within 48 hours, adds a <strong>Government ID verified</strong> badge to your profile.</p><p className="mt-3 text-sm leading-6 text-slate-600">Your ID-verified badge builds extra trust with renters.</p><p className="mt-4 border-t border-sky-100 pt-3 text-xs leading-5 text-slate-500">The badge confirms an identity check. It does not verify property ownership.</p></div></aside>
 </div>}</div></main>;
}
