import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Admin | ToLet Odisha', robots: { index: false, follow: false } };
export default function AdminLayout({ children }: { children: React.ReactNode }) { return children; }
