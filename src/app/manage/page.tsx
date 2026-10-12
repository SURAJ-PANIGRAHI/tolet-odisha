import ManagementForm from './management-form';
export const metadata = { title: 'Manage listing | ToLet Odisha', robots: { index: false, follow: false } };
export default async function ManagementPage({ searchParams }: { searchParams: Promise<{ listing?: string; key?: string }> }) {
  const { listing, key } = await searchParams;
  return <main className="mx-auto max-w-lg p-8 space-y-5"><h1 className="text-2xl font-bold">Manage your listing</h1><ManagementForm listing={listing || ''} managementKey={key || ''} /></main>;
}
