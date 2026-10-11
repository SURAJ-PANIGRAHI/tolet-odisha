import RenewalForm from './renewal-form';
export const metadata = { title: 'Confirm or renew | ToLet Odisha', robots: { index: false, follow: false } };
export default async function RenewalPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return <main className="mx-auto max-w-lg p-8 space-y-5"><h1 className="text-2xl font-bold">Keep your listing up to date</h1><RenewalForm token={token || ''} /></main>;
}
