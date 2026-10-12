import Link from 'next/link';
export const metadata = { title: 'Disclaimer | ToLet Odisha' };
export default function DisclaimerPage() {
  return <main className="mx-auto max-w-3xl px-6 py-12 space-y-7 text-slate-700">
    <Link href="/" className="text-[#005B94] underline">Back to ToLet Odisha</Link>
    <h1 className="text-3xl font-bold text-slate-900">Disclaimer</h1>
    <p>ToLet Odisha is a product of Anx Platforms, registered in Ireland.</p>
    <section className="space-y-3"><h2 className="text-xl font-semibold text-slate-900">A listing service</h2><p>ToLet Odisha provides a platform for users to publish and find accommodation listings. Anx Platforms and ToLet Odisha are not parties to rental agreements or transactions between users, owners, tenants, or other third parties.</p><p>Listing descriptions, photographs, prices, availability, and contact details are supplied by users. We do not guarantee their accuracy, authenticity, completeness, or suitability. An Email verified badge confirms access to an email address; it does not verify a phone number, identity, ownership of a property, or the truth of a listing.</p></section>
    <section className="space-y-3"><h2 className="text-xl font-semibold text-slate-900">Scams, misleading information, and liability</h2><p>To the extent permitted by applicable law, Anx Platforms and ToLet Odisha disclaim liability for scams, fraudulent conduct, misleading listings, disputes, or losses arising from user-supplied information or dealings between users. Nothing in this disclaimer excludes or limits liability that cannot lawfully be excluded or limits your statutory rights.</p></section>
    <section className="space-y-3"><h2 className="text-xl font-semibold text-slate-900">Check before you pay</h2><p>Independently verify the property, the person offering it, the terms, and payment details before making a commitment or transferring money. Do not share OTPs, passwords, or sensitive banking information with a person advertising a property.</p><p>Use the Report listing option to flag suspected scams or misleading information. We may review reports and remove or restrict listings. A listing appearing on the site is not an endorsement.</p></section>
  </main>;
}
