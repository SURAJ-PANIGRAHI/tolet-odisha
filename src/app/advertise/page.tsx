import Link from 'next/link';
import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Advertise With Us | ToLet Odisha' };
export default function AdvertisePage() {
  const whatsapp = 'https://wa.me/917428975781?text=' + encodeURIComponent('Hello Suraj! I would like to advertise my business on ToLet Odisha.');
  const email = 'mailto:support@toletodisha.in?subject=' + encodeURIComponent('Business advertising enquiry — ToLet Odisha');
  return <main className="min-h-screen bg-slate-50 px-4 py-12"><div className="mx-auto max-w-2xl space-y-6 rounded-2xl border border-slate-200 bg-white p-6 sm:p-10">
    <Link href="/" className="text-[#005B94] underline">← ToLet Odisha</Link>
    <h1 className="text-3xl font-bold text-slate-900">Advertise With Us</h1>
    <p className="text-slate-600">Promote your coaching centre, restaurant, or local business to people looking for rentals in Odisha. Contact Suraj directly to discuss placement, pricing, and availability.</p>
    <p className="text-slate-600">Business advertising enquiries are handled personally and separately from property listings and listing boosts.</p>
    <div className="flex flex-col gap-3">
      <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="rounded-xl bg-green-700 px-5 py-3 font-semibold text-white">WhatsApp: +91 74289 75781</a>
      <a href={email} className="break-all rounded-xl border border-[#005B94] px-5 py-3 font-semibold text-[#005B94]">Email: support@toletodisha.in</a>
    </div>
    <p className="text-sm text-slate-500">Please share your business name, district, and the promotion you have in mind.</p>
  </div></main>;
}
