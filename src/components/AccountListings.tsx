"use client";
import Link from 'next/link';
import { useCallback,useEffect,useState } from 'react';
import { House, MapPin, Plus, Pencil, RotateCcw, Trash2 } from 'lucide-react';
import type { Listing } from '@/lib/supabase';
import { accountListings } from '@/lib/client/account-listings';
import { PortalListingEditor } from './PortalListingEditor';
type OwnedListing=Listing&{removed_at:string|null;moderation_status:string};
export function AccountListings(){
 const [rows,setRows]=useState<OwnedListing[]>([]),[ready,setReady]=useState(false),[error,setError]=useState(''),[busy,setBusy]=useState(false),[edit,setEdit]=useState<Listing|null>(null);
 const [clock]=useState(()=>Date.now());
 const refresh=useCallback(async()=>{const result=await accountListings();setRows(result.listings);setReady(true);},[]);
 useEffect(()=>{const controller=new AbortController();accountListings(undefined,{},controller.signal).then(result=>{if(!controller.signal.aborted){setRows(result.listings);setReady(true);}}).catch(e=>{if(!controller.signal.aborted){setError(e.message);setReady(true);}});return()=>controller.abort();},[]);
 async function action(name:string,row:Listing){
  if(busy)return;if(name==='remove'&&!window.confirm('Remove this property from the website? This cannot be undone.'))return;
  setBusy(true);setError('');try{await accountListings(name,{listing_id:row.id});await refresh();}catch(e){setError(e instanceof Error?e.message:'Please retry.');}finally{setBusy(false);}
 }
 return <section className="space-y-5"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="flex items-center gap-2 text-xl font-bold"><House className="text-[#005B94]" size={22}/> My properties</h2><Link href="/?post=1" className="inline-flex items-center gap-2 rounded-full bg-[#005B94] px-4 py-2.5 text-sm font-bold text-white"><Plus size={16}/>Post a listing</Link></div>
 {error?<div role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}<button onClick={()=>void refresh().then(()=>setError('')).catch(()=>setError('Unable to load listings. Please retry.'))} className="ml-3 font-bold underline">Retry</button></div>:null}
 {!ready?<p role="status">Loading your properties…</p>:!rows.length?<div className="rounded-2xl border border-dashed border-sky-200 bg-white p-7 text-center"><House className="mx-auto text-[#005B94]" size={32}/><h3 className="mt-3 font-bold">Ready to let your property?</h3><p className="mt-2 text-sm leading-6 text-slate-500">Post your first listing. It will stay linked to your account so you can manage it on any device.</p><Link href="/?post=1" className="mt-4 inline-flex rounded-xl bg-sky-50 px-5 py-3 text-sm font-bold text-[#005B94]">Post Free Listing</Link></div>:<div className="grid gap-4">{rows.map(row=>{
  const expired=!!row.expires_at&&Date.parse(row.expires_at)<=clock;
  const renewable=!row.removed_at&&row.moderation_status==='approved'&&!!row.expires_at&&Date.parse(row.expires_at)<=clock+3*86400000;
  const status=row.removed_at?'Removed':row.moderation_status!=='approved'?'Under review':expired?'Expired':row.is_active?'Live':'Inactive';
  return <article key={row.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><h3 className="text-lg font-bold">{row.title}</h3><span className={`rounded-full px-3 py-1 text-xs font-bold ${status==='Live'?'bg-emerald-50 text-emerald-700':'bg-slate-100 text-slate-600'}`}>{status}</span></div><p className="mt-2 flex items-center gap-1 text-sm text-slate-500"><MapPin size={14}/>{row.locality}, {row.district}</p><p className="mt-3 text-lg font-bold">₹{row.rent_monthly.toLocaleString('en-IN')}<span className="text-xs font-normal text-slate-500"> / month</span></p><p className="mt-2 text-xs text-slate-500">Expires {row.expires_at?new Date(row.expires_at).toLocaleDateString('en-IN'):'—'}</p><div className="mt-4 flex flex-wrap gap-2"><button disabled={busy||!!row.removed_at} onClick={()=>setEdit(row)} className="inline-flex items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-semibold text-[#005B94] disabled:opacity-50"><Pencil size={15}/>Edit details & photos</button><button disabled={busy||!renewable} title="Renewal opens three days before expiry" onClick={()=>void action('renew',row)} className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm disabled:opacity-40"><RotateCcw size={15}/>Renew 30 days</button><button disabled={busy||!!row.removed_at} onClick={()=>void action('remove',row)} className="inline-flex items-center gap-2 rounded-xl border border-red-100 px-4 py-2 text-sm text-red-700 disabled:opacity-40"><Trash2 size={15}/>Remove</button></div></article>;
 })}</div>}

 {edit?<PortalListingEditor listing={edit} persistListing={listing=>accountListings('edit',{listing_id:listing.id,listing})} onClose={()=>setEdit(null)} onSaved={()=>{setEdit(null);void refresh().catch(()=>setError('Saved, but unable to refresh listings. Please reload.'));}}/>:null}
 </section>;
}
