'use client';
import type {Listing} from '@/lib/supabase';
import {MapPin,Phone,ArrowUpRight,House,Check,ShieldCheck} from 'lucide-react';
import {WhatsAppIcon} from './BrandIcons';
import {ListingVerificationStamp} from './VerificationBadges';
interface ListingCardProps{listing:Listing;isOdia:boolean;onSelect:(listing:Listing)=>void;preview?:boolean;}
export function ListingCard({listing,isOdia,onSelect,preview=false}:ListingCardProps){
 const phone=(listing.whatsapp_number||listing.contact_phone).replace(/\D/g,'');
 const normalized=phone.startsWith('91')&&phone.length===12?phone:'91'+phone;
 const waUrl=`https://wa.me/${normalized}?text=${encodeURIComponent(`Namaskar! I found your listing "${listing.title}" on ToLetOdisha. Is it still available?`)}`;
 return <article className="group flex min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow duration-200 hover:shadow-md">
  <button type="button" onClick={()=>onSelect(listing)} aria-label={`View ${listing.title}`} className="block w-full text-left focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-blue-600">
   <div className="relative m-3 mb-0 aspect-[16/9] overflow-hidden rounded-xl bg-slate-100">
    {listing.images?.[0]?<>
     {/* eslint-disable-next-line @next/next/no-img-element */}
     <img src={listing.images[0]} alt={listing.title} width={640} height={360} loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-200 motion-safe:group-hover:scale-[1.02]"/>
    </>:<div className="flex h-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-slate-50 to-blue-50 text-slate-500"><House size={36} strokeWidth={1.2}/><span className="text-xs font-medium">{isOdia?'ଫଟୋ ନାହିଁ':'Photos not added yet'}</span></div>}
    <span className="absolute left-3 top-3 max-w-[85%] truncate rounded-lg bg-white px-3 py-1.5 text-[11px] font-bold text-slate-800 shadow-sm">{listing.commercial_type||listing.category}</span>
    {listing.is_featured?<span className="absolute bottom-3 left-3 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">Featured</span>:null}
    {preview?<span className="absolute bottom-3 right-3 rounded-md bg-white/95 px-2 py-1 text-[10px] font-semibold text-slate-600">Sample illustration</span>:null}
   </div>
   <div className="p-5 sm:p-6"><div className="flex flex-wrap items-baseline gap-x-2 gap-y-1"><p className="text-[1.7rem] font-extrabold tracking-tight text-slate-900">₹{listing.rent_monthly.toLocaleString('en-IN')}</p><span className="text-sm text-slate-600">/ {isOdia?'ମାସିକ':'month'}</span>{listing.rent_negotiable?<span className="rounded-full bg-sky-50 px-2 py-1 text-xs font-semibold text-[#005B94]">Negotiable</span>:null}{listing.deposit>0?<span className="ml-auto text-[11px] font-medium text-slate-500">{isOdia?'ଅଗ୍ରିମ':'Deposit'} ₹{listing.deposit.toLocaleString('en-IN')}</span>:null}</div>
    <h3 className="mt-2 line-clamp-1 text-base font-bold tracking-tight text-slate-900 group-hover:text-[#005B94] sm:text-lg">{listing.title}</h3>
    <p className="mt-2 flex items-center gap-1.5 text-sm text-slate-600"><MapPin size={14} className="shrink-0 text-blue-600"/><span className="truncate">{listing.locality}, {listing.district}</span></p>
    <div className="mt-4 flex min-h-7 flex-wrap items-center gap-2">{listing.id_verified?<span title="Government ID reviewed. This does not verify property ownership." className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-[11px] font-bold text-emerald-800"><ShieldCheck size={14}/>Verified Profile</span>:<ListingVerificationStamp listing={listing}/>}<span className="text-[11px] text-slate-500">{listing.advertiser_type||'Advertiser'} · {isOdia?'ସ୍ୱଘୋଷିତ':'self-declared'}</span></div>
    <div className="mt-4 flex min-h-6 flex-wrap gap-x-4 gap-y-2 text-xs text-slate-600">{listing.area_sqft!=null?<span>{listing.area_sqft.toLocaleString('en-IN')} sq ft</span>:null}{listing.amenities?.slice(0,3).map(amenity=><span key={amenity} className="inline-flex items-center gap-1"><Check size={12} className="text-slate-400"/>{amenity}</span>)}</div>
   </div>
  </button>
  <div className="mx-5 mt-auto flex flex-wrap items-center gap-2 border-t border-slate-100 py-4 sm:mx-6">
   {preview?<button type="button" onClick={()=>onSelect(listing)} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 text-xs font-bold text-white"><WhatsAppIcon width={16} height={16}/>WhatsApp preview</button>:<a href={waUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 text-xs font-bold text-white transition-colors hover:bg-emerald-800"><WhatsAppIcon width={16} height={16}/>WhatsApp</a>}
   {preview?<button onClick={()=>onSelect(listing)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 px-4 text-xs font-bold text-slate-700"><Phone size={14}/>Call preview</button>:<a href={`tel:${listing.contact_phone}`} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 px-4 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50"><Phone size={14}/>{isOdia?'କଲ୍ କରନ୍ତୁ':'Call'}</a>}
   <button type="button" onClick={()=>onSelect(listing)} aria-label={`View details for ${listing.title}`} className="inline-flex min-h-11 items-center justify-center rounded-xl px-3 text-[#005B94] transition-colors hover:bg-sky-50"><ArrowUpRight size={18}/></button>
  </div>
 </article>;
}
