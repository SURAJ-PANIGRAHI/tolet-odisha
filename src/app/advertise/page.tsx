import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowLeft, ArrowUpRight, GraduationCap, Utensils, Store, MapPin, Mail, Megaphone, MessageCircle } from 'lucide-react';
import { WhatsAppIcon } from '@/components/BrandIcons';
export const metadata: Metadata = { title: 'Advertise With Us | ToLet Odisha' };
export default function AdvertisePage() {
 const message = 'Hello ToLet Odisha! I would like to advertise my business.\n\nBusiness name: \nBusiness type: \nDistrict / locality: \nWhat I would like to promote: \n\nPlease share the available placements and pricing.';
 const whatsapp = 'https://wa.me/917428975781?text=' + encodeURIComponent(message);
 const email = 'mailto:support@toletodisha.in?subject=' + encodeURIComponent('Business advertising enquiry — ToLet Odisha') + '&body=' + encodeURIComponent(message);
 return <main className="min-h-screen bg-slate-50 px-4 py-7 sm:py-10"><div className="mx-auto max-w-5xl">
  <Link href="/" className="inline-flex items-center gap-2 text-sm font-bold text-[#005B94]"><ArrowLeft size={17}/> Back to ToLet Odisha</Link>
  <div className="mt-7 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-sky-900/5"><div className="grid lg:grid-cols-[1.1fr_1fr]">
   <section className="relative overflow-hidden bg-[#005B94] p-7 text-white sm:p-10"><div className="pointer-events-none absolute -bottom-24 -right-20 h-80 w-80 rounded-full border-[45px] border-white/5"/><span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold uppercase tracking-wider"><Megaphone size={15}/> Advertise with us</span><h1 className="mt-6 text-3xl font-extrabold leading-tight sm:text-4xl">Your business.<br/>Odisha’s next discovery.</h1><p className="mt-5 max-w-md leading-7 text-sky-100">Introduce your business to people finding their next home in Odisha. Let’s find the right place for your promotion.</p>
    <div className="relative mt-8 grid gap-3"><div className="flex items-center gap-3 rounded-xl bg-white/10 p-3.5"><GraduationCap size={22}/><span className="text-sm font-semibold">Coaching centres & education</span></div><div className="flex items-center gap-3 rounded-xl bg-white/10 p-3.5"><Utensils size={22}/><span className="text-sm font-semibold">Restaurants & local favourites</span></div><div className="flex items-center gap-3 rounded-xl bg-white/10 p-3.5"><Store size={22}/><span className="text-sm font-semibold">Shops, services & growing businesses</span></div></div>
    <p className="relative mt-7 flex items-center gap-2 text-xs font-medium text-sky-100"><MapPin size={15}/> Built for local connections across Odisha</p>
   </section>
   <section className="flex flex-col justify-center p-7 sm:p-10"><span className="mb-5 inline-flex w-fit rounded-2xl bg-sky-50 p-4 text-[#005B94]"><MessageCircle size={28}/></span><h2 className="text-2xl font-bold text-slate-900">Let’s talk about your business</h2><p className="mt-3 text-sm leading-7 text-slate-500">Contact Suraj directly to discuss placement, pricing, and availability. Share a few details and we’ll take it from there.</p>
    <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="mt-7 flex items-center justify-between gap-3 rounded-xl bg-[#128C4A] px-5 py-4 font-bold text-white shadow-sm transition hover:bg-[#0c743c]"><span className="flex items-center gap-3"><WhatsAppIcon/> Chat on WhatsApp</span><ArrowUpRight size={19}/></a><p className="mt-2 text-xs text-slate-500">Opens WhatsApp with an enquiry ready for you to complete and send.</p>
    <a href={email} className="mt-5 flex items-center gap-3 rounded-xl border border-sky-200 bg-sky-50 px-5 py-4 text-[#005B94]"><Mail size={22}/><span><span className="block text-sm font-bold">Prefer email?</span><span className="break-all text-xs">support@toletodisha.in</span></span></a>
    <div className="mt-7 border-t border-slate-100 pt-5"><p className="text-xs leading-6 text-slate-500">Have a property to let? <Link href="/" className="font-semibold text-[#005B94] underline">Post a property listing</Link>. This page is for business advertising enquiries, handled personally.</p></div>
   </section>
  </div></div>
 </div></main>;
}
