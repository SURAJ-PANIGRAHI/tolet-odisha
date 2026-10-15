import {ContentShell} from '@/components/ContentShell';
import { PortalManagement } from '@/components/PortalManagement';
import ManagementForm from './management-form';
export const metadata = { title: 'Manage listing | ToLet Odisha', robots: { index: false, follow: false }, referrer: 'no-referrer' as const };
export default async function ManagementPage({ searchParams }: { searchParams: Promise<{ listing?: string; key?: string; portal?: string }> }) {
  const { listing, key, portal } = await searchParams;
  return <ContentShell title="Manage your listing" eyebrow="Listing management">{portal === '1' ? <PortalManagement listingId={listing || ''} /> : <ManagementForm listing={listing || ''} managementKey={key || ''} />}</ContentShell>;
}
