import { PortalManagement } from '@/components/PortalManagement';
import ManagementForm from './management-form';
export const metadata = { title: 'Manage listing | ToLet Odisha', robots: { index: false, follow: false }, referrer: 'no-referrer' as const };
export default async function ManagementPage({ searchParams }: { searchParams: Promise<{ listing?: string; key?: string; portal?: string }> }) {
  const { listing, key, portal } = await searchParams;
  return <main className="mx-auto max-w-lg p-8 space-y-5"><h1 className="text-2xl font-bold">Manage your listing</h1>{portal === '1' ? <PortalManagement listingId={listing || ''} /> : <ManagementForm listing={listing || ''} managementKey={key || ''} />}</main>;
}
