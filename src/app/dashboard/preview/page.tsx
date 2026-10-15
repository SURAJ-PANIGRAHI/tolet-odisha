import type {Metadata} from 'next';
import {OwnerDashboard} from '@/components/OwnerDashboard';
export const metadata:Metadata={title:'Owner Dashboard Preview | ToLet Odisha',robots:{index:false,follow:false}};
export default function DashboardPreview(){return <OwnerDashboard preview/>;}
