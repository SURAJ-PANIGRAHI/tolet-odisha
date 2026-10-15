import {ContentShell} from '@/components/ContentShell';
import RenewalForm from './renewal-form';
export const metadata = { title: 'Confirm or renew | ToLet Odisha', robots: { index: false, follow: false } };
export default async function RenewalPage({ searchParams }: { searchParams: Promise<{ token?: string; portal?: string }> }) {
  const { token, portal } = await searchParams;
  return <ContentShell title="Keep your listing up to date" eyebrow="Listing renewal"><RenewalForm token={token || ''} portal={portal === '1'} /></ContentShell>;
}
