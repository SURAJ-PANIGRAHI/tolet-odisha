import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AdvertiserSession } from '@/components/AdvertiserSession';

export const metadata: Metadata = {
  title: 'ToLet Odisha | To-Let Rooms, Hostels & Flats in Balasore & Odisha',
  description: 'Find rooms, Ladies Mess, PG accommodation, hostels, flats and commercial properties in Balasore and across Odisha. ToLet Odisha charges no rental commission. Contact property advertisers via WhatsApp.',
  keywords: ['To Let Balasore', 'Rooms in Balasore', 'Boys mess Balasore', 'Hostel Balasore', 'ToLet Odisha', 'Rent in Odisha', 'FM college rooms'],
  authors: [{ name: 'ToLet Odisha' }],
  manifest: '/manifest.json',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#059669',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans bg-[#f8fafc]">
        <AdvertiserSession>{children}</AdvertiserSession>
      </body>
    </html>
  );
}
