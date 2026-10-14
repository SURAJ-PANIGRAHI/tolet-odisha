"use client";
import Link from 'next/link';
import { useState } from 'react';
import { useBrowserLocation } from '@/lib/client/use-browser-location';
import { CircleCheck, Copy, LayoutDashboard, ArrowRight, LockKeyhole, House } from 'lucide-react';
import { managementPath, savedListings } from '@/lib/client/saved-listings';
export function ListingPosted() {
 const href = useBrowserLocation();
 const [message, setMessage] = useState('');
 const path = href ? managementPath(new URLSearchParams(new URL(href).hash.slice(1)).get('manage') || '') || '' : '';
 const title = href ? savedListings().find(row => row.path === path)?.title || '' : '';
 const ready = !!href;
 async function copy() { try { await navigator.clipboard.writeText(window.location.origin + path); setMessage('Private link copied. Keep it somewhere safe.'); } catch { setMessage('Select and copy the link below.'); } }
 return <main className="min-h-screen bg-gradient-to-b from-sky-50 to-slate-50 px-4 py-10 sm:py-16"><div className="mx-auto max-w-xl"><Link href="/" className="inline-flex items-center gap-2 text-sm font-bold text-[#005B94]"><House size={18}/> ToLet Odisha</Link><section className="mt-7 rounded-3xl border border-sky-100 bg-white p-6 shadow-xl shadow-sky-900/5 sm:p-10">
 {!ready ? <p role="status">Loading your listing confirmation…</p> : !path ? <><h1 className="text-2xl font-bold">Find your listing</h1><p className="mt-3 text-slate-500">Open your dashboard or use the private link saved after posting.</p><Link href="/dashboard" className="mt-5 inline-flex rounded-xl bg-[#005B94] px-5 py-3 font-bold text-white">Manage My Listings</Link></> : <>
 <span className="inline-flex rounded-2xl bg-emerald-50 p-4 text-emerald-600"><CircleCheck size={36}/></span><h1 className="mt-5 text-3xl font-extrabold text-slate-900">Your property is listed!</h1><p className="mt-3 leading-7 text-slate-500">{title ? <strong className="text-slate-800">{title}. </strong> : null}Your listing was published for 30 days. You can manage it using your private link.</p>
 <Link prefetch={false} href={path} className="mt-7 flex items-center justify-center gap-2 rounded-xl bg-[#005B94] px-5 py-3.5 font-bold text-white hover:bg-[#004A7C]">Manage this listing <ArrowRight size={19}/></Link><Link href="/dashboard" className="mt-3 flex items-center justify-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-5 py-3.5 font-bold text-[#005B94]"><LayoutDashboard size={18}/> Manage My Listings</Link>
 <div className="mt-7 rounded-2xl bg-slate-50 p-4"><h2 className="flex items-center gap-2 text-sm font-bold"><LockKeyhole size={17}/> Keep your management link private</h2><p className="mt-2 text-sm leading-6 text-slate-500">Anyone with this link can manage your listing. Save a copy to use it on another device.</p><label htmlFor="private-listing-link" className="sr-only">Private management link</label><input id="private-listing-link" readOnly value={typeof window !== 'undefined' ? window.location.origin + path : ''} onFocus={e=>e.currentTarget.select()} className="mt-3 w-full rounded-lg border border-slate-200 bg-white p-2 text-xs"/><button onClick={() => void copy()} className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-[#005B94]"><Copy size={16}/> Copy private link</button>{message ? <p role="status" className="mt-2 text-sm text-slate-600">{message}</p> : null}</div>
 <div className="mt-5 rounded-xl border border-sky-100 bg-sky-50 p-4"><h2 className="text-sm font-bold text-[#005B94]">Next: help renters recognise you</h2><p className="mt-2 text-sm leading-6 text-slate-600">Verification is optional. Profile badges show renters which of your details have been checked.</p><Link href="/dashboard#profile-verification" className="mt-2 inline-flex text-sm font-semibold text-[#005B94] underline">Explore profile badges</Link></div>
 <Link href="/" className="mt-6 block text-center text-sm font-semibold text-[#005B94]">Back to all properties</Link></>}
 </section></div></main>;
}
