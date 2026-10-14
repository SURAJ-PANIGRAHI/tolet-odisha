"use client";
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowUpRight, House, KeyRound, Link2, MapPin } from 'lucide-react';
import { savedListings, managementPath, saveListing, forgetListing, type SavedListing } from '@/lib/client/saved-listings';
export function SavedListings({ hidePortal = false }: { hidePortal?: boolean }) {
 const [rows, setRows] = useState<SavedListing[]>([]);
 const [ready, setReady] = useState(false);
 const [link, setLink] = useState('');
 const [message, setMessage] = useState('');
 useEffect(() => {
  const sync = () => { setRows(savedListings()); setReady(true); };
  sync(); window.addEventListener('storage', sync); window.addEventListener('tolet-listings-changed', sync);
  return () => { window.removeEventListener('storage', sync); window.removeEventListener('tolet-listings-changed', sync); };
 }, []);
 const visible = rows.filter(row => !hidePortal || !row.path.includes('portal=1'));
 function restore(event: React.FormEvent) {
  event.preventDefault();
  const path = managementPath(link.trim());
  if (!path) { setMessage('Paste the complete private management link you received after posting.'); return; }
  const id = new URL(path, window.location.origin).searchParams.get('listing')!;
  const existing = rows.find(row => row.id === id);
  const saved = saveListing(existing || { id, path, title: 'Saved property', locality: 'Open the management page to continue', rent: 0, savedAt: new Date().toISOString() });
  if (!saved) { setMessage('Your browser could not save this link. Keep a private copy.'); return; }
  setLink(''); setMessage('Private link saved. Its validity will be checked when you manage the listing.');
 }
 return <section aria-labelledby="saved-properties-heading" className="space-y-5">
  <div className="flex items-center gap-3"><span className="rounded-xl bg-sky-100 p-2.5 text-[#005B94]"><House size={22}/></span><div><h2 id="saved-properties-heading" className="text-xl font-bold text-slate-900">Your property listings</h2><p className="text-sm text-slate-500">Private management links saved on this browser.</p></div></div>
  {!ready ? <p role="status">Loading your properties…</p> : visible.length ? <div className="grid gap-4 sm:grid-cols-2">{visible.map(row => <article key={row.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
   <span className="text-xs font-semibold uppercase tracking-wider text-[#005B94]">Saved on this device</span><h3 className="mt-2 text-lg font-bold text-slate-900">{row.title}</h3><p className="mt-2 flex items-center gap-1 text-sm text-slate-500"><MapPin size={14}/>{row.locality}</p>{row.rent > 0 ? <p className="mt-3 text-lg font-bold">₹{row.rent.toLocaleString('en-IN')}<span className="text-xs font-normal text-slate-500"> / month when posted</span></p> : null}
   <Link prefetch={false} href={row.path} className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-[#005B94] px-4 py-3 text-sm font-bold text-white hover:bg-[#004A7C]">Manage listing <ArrowUpRight size={17}/></Link>
   <button type="button" className="mt-3 text-xs text-slate-500 underline" onClick={() => { if (window.confirm('Forget this private link on this browser? This does not remove the property. Save a copy first.')) forgetListing(row.id); }}>Forget saved link</button>
  </article>)}</div> : <div className="rounded-2xl border border-dashed border-sky-200 bg-white p-7 text-center"><KeyRound className="mx-auto text-sky-600" size={28}/><h3 className="mt-3 font-bold">Your listings will appear here</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">New listings will appear here after you post. For an earlier listing, add your private management link below.</p><Link href="/" className="mt-4 inline-flex rounded-full bg-sky-50 px-5 py-2.5 text-sm font-semibold text-[#005B94]">Browse or post a property</Link></div>}
  <details className="rounded-2xl border border-slate-200 bg-white p-5"><summary className="cursor-pointer text-sm font-semibold text-[#005B94]">Already have a private management link?</summary><form onSubmit={restore} className="mt-4 space-y-3"><label htmlFor="saved-management-link" className="block text-sm text-slate-600">Paste your link to save it on this browser. Keep it private.</label><input id="saved-management-link" type="text" autoComplete="off" value={link} onChange={e => setLink(e.target.value)} required placeholder="Paste your private management link" className="w-full rounded-xl border border-slate-200 p-3 text-sm"/><button className="inline-flex items-center gap-2 rounded-xl bg-[#005B94] px-4 py-2.5 text-sm font-bold text-white"><Link2 size={16}/> Save management link</button>{message ? <p role="status" className="text-sm text-slate-600">{message}</p> : null}</form></details>
  <p className="text-xs leading-5 text-slate-500">Saved links are specific to this website address and browser. Keep a private copy before clearing browsing data or moving to another device. Property availability may have changed since posting.</p>
 </section>;
}
